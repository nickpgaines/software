import crypto from "node:crypto";

export type PlatformTwilioCreds = {
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
};

export type PlatformTwilioStatus = {
  configured: boolean;
  messagingConfigured: boolean;
  voiceConfigured: boolean;
  missing: string[];
};

function readEnv(name: string): string {
  return (process.env[name] || "").trim();
}

export function getPlatformTwilioStatus(): PlatformTwilioStatus {
  const missing: string[] = [];
  const accountSid = readEnv("TWILIO_ACCOUNT_SID");
  const authToken = readEnv("TWILIO_AUTH_TOKEN");
  const apiKeySid = readEnv("TWILIO_API_KEY_SID");
  const apiKeySecret = readEnv("TWILIO_API_KEY_SECRET");
  const twimlAppSid = readEnv("TWILIO_TWIML_APP_SID");

  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!apiKeySid) missing.push("TWILIO_API_KEY_SID");
  if (!apiKeySecret) missing.push("TWILIO_API_KEY_SECRET");
  if (!twimlAppSid) missing.push("TWILIO_TWIML_APP_SID");

  const messagingConfigured = !!(accountSid && authToken);
  const voiceConfigured = !!(
    accountSid &&
    authToken &&
    apiKeySid &&
    apiKeySecret &&
    twimlAppSid
  );

  return {
    configured: missing.length === 0,
    messagingConfigured,
    voiceConfigured,
    missing,
  };
}

export function getPlatformTwilioCreds(): PlatformTwilioCreds {
  const status = getPlatformTwilioStatus();
  if (!status.configured) {
    throw new Error(
      `Platform Twilio is not configured. Missing env: ${status.missing.join(", ")}`
    );
  }
  return {
    accountSid: readEnv("TWILIO_ACCOUNT_SID"),
    authToken: readEnv("TWILIO_AUTH_TOKEN"),
    apiKeySid: readEnv("TWILIO_API_KEY_SID"),
    apiKeySecret: readEnv("TWILIO_API_KEY_SECRET"),
    twimlAppSid: readEnv("TWILIO_TWIML_APP_SID"),
  };
}

export function basicAuthHeader(sid: string, token: string): string {
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

// Twilio computes X-Twilio-Signature as the base64 HMAC-SHA1 of:
//   fullRequestUrl + concat(sortedKey + value for each POST param)
// using the auth token as the key.
export function verifyTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string;
}): boolean {
  const { authToken, url, params, signature } = args;
  if (!authToken || !signature) return false;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const k of keys) data += k + params[k];
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(data, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

// Identity format used in Voice SDK access tokens:
//   c<companyId>_<sanitized-user>
// The outbound TwiML route parses the leading `c<id>` segment from the From
// parameter (which Twilio sends as `client:<identity>`) to determine which
// tenant is making the call.
export function buildVoiceIdentity(companyId: number, user: string): string {
  const sanitized = (user || "user").replace(/[^a-zA-Z0-9_.-]/g, "_") || "user";
  return `c${companyId}_${sanitized}`;
}

export function parseCompanyFromIdentity(identity: string): number | null {
  const m = /^c(\d+)_/.exec(identity || "");
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseCompanyFromVoiceFrom(from: string): number | null {
  // Twilio sends the caller as `client:<identity>` for browser-originated calls.
  if (!from) return null;
  const stripped = from.startsWith("client:") ? from.slice("client:".length) : from;
  return parseCompanyFromIdentity(stripped);
}

export function publicBaseUrlFromRequest(req: Request): string {
  const envBase = readEnv("TWILIO_PUBLIC_BASE_URL");
  if (envBase) return envBase.replace(/\/+$/, "");
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}
