import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

export type ResolvedWebsiteAddress = {
  address: string;
  family: number;
};

export type PublicWebsiteDependencies = {
  resolver?: (hostname: string) => Promise<ResolvedWebsiteAddress[]>;
  fetcher?: (
    url: URL,
    init: RequestInit,
    addresses: readonly ResolvedWebsiteAddress[]
  ) => Promise<Pick<Response, "status" | "headers">>;
  timeoutMs?: number;
};

const WEBSITE_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

function isReservedHostname(hostname: string): boolean {
  if (!hostname.includes(".")) return true;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "home.arpa" ||
    hostname.endsWith(".home.arpa")
  ) {
    return true;
  }
  for (const suffix of [
    ".alt",
    ".arpa",
    ".example",
    ".invalid",
    ".local",
    ".onion",
    ".test",
  ]) {
    if (hostname.endsWith(suffix)) return true;
  }
  return ["example.com", "example.net", "example.org"].some(
    (reserved) => hostname === reserved || hostname.endsWith(`.${reserved}`)
  );
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (
    octets.some(
      (part, index) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255 ||
        String(part) !== parts[index]
    )
  ) {
    return null;
  }
  return octets;
}

function isPublicIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function parseIpv6(address: string): number[] | null {
  let input = address.toLowerCase();
  if (input.includes("%")) return null;
  if (input.includes(".")) {
    const separator = input.lastIndexOf(":");
    if (separator < 0) return null;
    const ipv4 = parseIpv4(input.slice(separator + 1));
    if (!ipv4) return null;
    input =
      input.slice(0, separator + 1) +
      ((ipv4[0] << 8) | ipv4[1]).toString(16) +
      ":" +
      ((ipv4[2] << 8) | ipv4[3]).toString(16);
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const omitted = 8 - left.length - right.length;
  if ((halves.length === 1 && omitted !== 0) || omitted < 0) return null;
  const groups = [
    ...left,
    ...Array(halves.length === 2 ? omitted : 0).fill("0"),
    ...right,
  ];
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  return groups.flatMap((part) => {
    const value = Number.parseInt(part, 16);
    return [value >> 8, value & 0xff];
  });
}

function isPublicIpv6(address: string): boolean {
  const bytes = parseIpv6(address);
  if (!bytes) return false;
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (allZero || loopback) return false;

  const mappedIpv4 =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  if (mappedIpv4) return false;

  if (bytes.slice(0, 12).every((byte) => byte === 0)) return false;
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((byte) => byte === 0)
  ) {
    return false;
  }
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes[4] === 0x00 &&
    bytes[5] === 0x01
  ) {
    return false;
  }

  if ((bytes[0] & 0xfe) === 0xfc) return false;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false;
  if (bytes[0] === 0xff) return false;
  if (bytes[0] === 0x01 && bytes.slice(1, 8).every((byte) => byte === 0)) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && (bytes[2] & 0xfe) === 0) return false;
  if (
    bytes[0] === 0x20 &&
    bytes[1] === 0x01 &&
    bytes[2] === 0x0d &&
    bytes[3] === 0xb8
  ) {
    return false;
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false;
  if (bytes[0] === 0x3f && bytes[1] === 0xff && (bytes[2] & 0xf0) === 0) return false;
  if (bytes[0] === 0x5f && bytes[1] === 0x00) return false;
  return true;
}

function isPublicAddress(address: ResolvedWebsiteAddress): boolean {
  const family = Number(address.family);
  if (family === 4 && isIP(address.address) === 4) return isPublicIpv4(address.address);
  if (family === 6 && isIP(address.address) === 6) return isPublicIpv6(address.address);
  return false;
}

function validateWebsiteUrl(url: URL): string | null {
  if (url.protocol !== "https:") return "Business website must use public HTTPS.";
  if (url.username || url.password) {
    return "Business website URL cannot include credentials.";
  }
  const hostname = normalizedHostname(url);
  if (isIP(hostname) !== 0) {
    return "Business website must use a public hostname, not an IP address.";
  }
  if (isReservedHostname(hostname)) {
    return "Business website must use a public hostname.";
  }
  return null;
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new Error("website-validation-timeout"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => reject(new Error("website-validation-timeout")),
      { once: true }
    );
  });
}

async function withDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return Promise.race([promise, waitForAbort(signal)]);
}

function fetchPinnedWebsite(
  url: URL,
  init: RequestInit,
  addresses: readonly ResolvedWebsiteAddress[]
): Promise<Pick<Response, "status" | "headers">> {
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    const requestedFamily = Number(options.family || 0);
    const candidates = requestedFamily
      ? addresses.filter((address) => address.family === requestedFamily)
      : addresses;
    if (!candidates.length) {
      const error = new Error("No validated address matches the requested family") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      callback(error, "", requestedFamily);
      return;
    }
    if (options.all) {
      callback(
        null,
        candidates.map((address) => ({
          address: address.address,
          family: address.family as 4 | 6,
        }))
      );
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: init.method ?? "GET",
        signal: init.signal ?? undefined,
        lookup: pinnedLookup,
      },
      (response) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(name, item);
          } else if (value !== undefined) {
            headers.set(name, String(value));
          }
        }
        resolve({ status: response.statusCode ?? 0, headers });
        response.destroy();
      }
    );
    request.once("error", reject);
    request.end();
  });
}

export async function verifyPublicWebsite(
  url: URL,
  dependencies: PublicWebsiteDependencies = {}
): Promise<string | null> {
  const resolver =
    dependencies.resolver ??
    ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  const fetcher = dependencies.fetcher ?? fetchPinnedWebsite;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? WEBSITE_TIMEOUT_MS
  );

  try {
    let current = new URL(url.href);
    let redirects = 0;
    while (true) {
      const urlError = validateWebsiteUrl(current);
      if (urlError) return urlError;

      let addresses: ResolvedWebsiteAddress[];
      try {
        addresses = await withDeadline(
          resolver(normalizedHostname(current)),
          controller.signal
        );
      } catch {
        if (controller.signal.aborted) return "Business website validation timed out.";
        return "Business website hostname could not be resolved to a public address.";
      }
      if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
        return "Business website hostname must resolve only to public addresses.";
      }

      let response: Pick<Response, "status" | "headers">;
      try {
        response = await withDeadline(
          fetcher(
            current,
            {
              method: "GET",
              redirect: "manual",
              signal: controller.signal,
            },
            addresses
          ),
          controller.signal
        );
      } catch {
        if (controller.signal.aborted) return "Business website validation timed out.";
        return "Business website could not be reached.";
      }

      if (response.status >= 300 && response.status <= 399) {
        const location = response.headers.get("location");
        if (!location) return null;
        if (redirects >= MAX_REDIRECTS) {
          return "Business website has too many redirects.";
        }
        try {
          current = new URL(location, current);
        } catch {
          return "Business website returned an invalid redirect.";
        }
        redirects += 1;
        continue;
      }
      if (response.status >= 200 && response.status <= 399) return null;
      return `Business website returned HTTP ${response.status}.`;
    }
  } finally {
    clearTimeout(timeout);
  }
}
