import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublicWebsite } from "../src/lib/public-website.ts";

const publicAddress = [{ address: "93.184.216.34", family: 4 as const }];

test("accepts a reachable public HTTPS website without automatic redirects", async () => {
  let sawManualRedirect = false;
  const error = await verifyPublicWebsite(new URL("https://forgecrm.app"), {
    resolver: async () => publicAddress,
    fetcher: async (_url, init) => {
      sawManualRedirect = init?.redirect === "manual";
      assert.ok(init?.signal);
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(error, null);
  assert.equal(sawManualRedirect, true);
});

test("pins each request to the public addresses that passed validation", async () => {
  let pinned: unknown = null;
  const error = await verifyPublicWebsite(new URL("https://forgecrm.app"), {
    resolver: async () => publicAddress,
    fetcher: async (_url, _init, addresses) => {
      pinned = addresses;
      return new Response(null, { status: 200 });
    },
  });
  assert.equal(error, null);
  assert.deepEqual(pinned, publicAddress);
});

test("accepts ordinary IPv6 addresses from allocated global-unicast ranges", async () => {
  for (const address of ["2001:4860:4860::8888", "2606:4700:4700::1111", "2a00:1450:4009::200e"]) {
    const error = await verifyPublicWebsite(new URL("https://safe-business.com"), {
      resolver: async () => [{ address, family: 6 }],
      fetcher: async () => new Response(null, { status: 200 }),
    });
    assert.equal(error, null, address);
  }
});

test("rejects non-HTTPS, credentials, IP literals, localhost, and reserved names", async () => {
  const cases = [
    "http://example.com",
    "https://user:password@example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://localhost",
    "https://service.localhost",
    "https://example.test",
    "https://example.invalid",
    "https://printer.local",
    "https://service.onion",
    "https://service.alt",
    "https://ipv4only.arpa",
    "https://home.arpa",
    "https://example.com",
  ];
  for (const value of cases) {
    const error = await verifyPublicWebsite(new URL(value), {
      resolver: async () => publicAddress,
      fetcher: async () => new Response(null, { status: 200 }),
    });
    assert.match(error || "", /public HTTPS|credentials|hostname|address/i, value);
  }
});

test("rejects every private, loopback, link-local, multicast, or reserved address", async () => {
  const addresses = [
    "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1",
    "169.254.1.1", "172.16.0.1", "192.0.0.1", "192.0.2.1",
    "192.88.99.1", "192.168.1.1", "198.18.0.1", "198.51.100.1", "203.0.113.1",
    "224.0.0.1", "240.0.0.1", "255.255.255.255", "::", "::1",
    "::8.8.8.8", "::ffff:8.8.8.8", "::ffff:127.0.0.1",
    "64:ff9b::808:808", "100::1",
    "3ffe::1", "2000::1", "2001:db8::1", "2002:7f00::1",
    "2200::1", "2d00::1", "3000::1", "3fff::1", "5f00::1",
    "100:0:0:1::1", "4000::1",
    "fc00::1", "fe80::1", "fec0::1", "ff00::1",
  ];
  for (const address of addresses) {
    const error = await verifyPublicWebsite(new URL("https://safe-business.com"), {
      resolver: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
      fetcher: async () => {
        throw new Error("private addresses must never be fetched");
      },
    });
    assert.match(error || "", /public address/i, address);
  }
});

test("rejects a hostname when any resolved address is non-public", async () => {
  const error = await verifyPublicWebsite(new URL("https://safe-business.com"), {
    resolver: async () => [
      ...publicAddress,
      { address: "10.0.0.1", family: 4 },
    ],
    fetcher: async () => {
      throw new Error("mixed DNS results must never be fetched");
    },
  });
  assert.match(error || "", /public address/i);
});

test("validates redirect targets before following them", async () => {
  const resolved: string[] = [];
  let fetches = 0;
  const error = await verifyPublicWebsite(new URL("https://public-business.com"), {
    resolver: async (hostname) => {
      resolved.push(hostname);
      return hostname === "public-business.com"
        ? publicAddress
        : [{ address: "169.254.169.254", family: 4 }];
    },
    fetcher: async () => {
      fetches += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://metadata.attacker.com/latest" },
      });
    },
  });
  assert.match(error || "", /public address/i);
  assert.deepEqual(resolved, ["public-business.com", "metadata.attacker.com"]);
  assert.equal(fetches, 1);
});

test("follows at most three redirects", async () => {
  let fetches = 0;
  const error = await verifyPublicWebsite(new URL("https://public-business.com/0"), {
    resolver: async () => publicAddress,
    fetcher: async (url) => {
      fetches += 1;
      const step = Number(new URL(String(url)).pathname.slice(1));
      return new Response(null, {
        status: 302,
        headers: { location: `https://public-business.com/${step + 1}` },
      });
    },
  });
  assert.match(error || "", /too many redirects/i);
  assert.equal(fetches, 4);
});

test("rejects unreachable and unsuccessful websites", async () => {
  const unreachable = await verifyPublicWebsite(new URL("https://public-business.com"), {
    resolver: async () => publicAddress,
    fetcher: async () => {
      throw new Error("connection refused");
    },
  });
  assert.match(unreachable || "", /could not be reached/i);

  const unsuccessful = await verifyPublicWebsite(new URL("https://public-business.com"), {
    resolver: async () => publicAddress,
    fetcher: async () => new Response(null, { status: 404 }),
  });
  assert.match(unsuccessful || "", /HTTP 404/i);
});

test("aborts website validation after its configured deadline", async () => {
  const error = await verifyPublicWebsite(new URL("https://public-business.com"), {
    resolver: async () => publicAddress,
    timeoutMs: 1,
    fetcher: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
  assert.match(error || "", /timed out/i);
});
