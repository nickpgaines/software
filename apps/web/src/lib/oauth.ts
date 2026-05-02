import crypto from "node:crypto";

function secret() {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return "dev-secret-change-me";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createOAuthState(provider: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${provider}:${nonce}:${Date.now()}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyOAuthState(
  token: string | undefined,
  expectedProvider: string,
  maxAgeMs = 10 * 60 * 1000
): boolean {
  if (!token) return false;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return false;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  ) {
    return false;
  }
  const [provider, , tsStr] = payload.split(":");
  if (provider !== expectedProvider) return false;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > maxAgeMs) return false;
  return true;
}

export const OAUTH_STATE_COOKIE = "oauth_state";
