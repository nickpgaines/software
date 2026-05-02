import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "crm_session";

function secret() {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production. Set it to a long random string."
    );
  }
  return "dev-secret-change-me";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createSessionToken(username: string) {
  const payload = `${username}:${Date.now()}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  ) {
    return null;
  }
  const [username] = payload.split(":");
  return username || null;
}

export function getSessionUser(): string | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export const SESSION_COOKIE = COOKIE_NAME;
