import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

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

export type SessionContext = {
  // The cookie identity. For the env-admin login this is the configured
  // ADMIN_USERNAME; for staff this is the staff member's email.
  identity: string;
  // The staff row backing the session, if any. Null for the env-admin login.
  staffId: number | null;
  // The tenant the request operates on. Env-admin defaults to company 1
  // (the legacy/platform tenant).
  companyId: number;
  // True for the env-admin backdoor; false for tenant staff.
  isPlatformAdmin: boolean;
};

const ADMIN_USER = () => process.env.ADMIN_USERNAME || "admin";

// Resolve the cookie identity to a full session context (staffId + companyId).
// Returns null when the cookie is missing or invalid, so callers can return 401.
export async function getSessionContext(): Promise<SessionContext | null> {
  const identity = getSessionUser();
  if (!identity) return null;

  if (identity === ADMIN_USER()) {
    return {
      identity,
      staffId: null,
      companyId: 1,
      isPlatformAdmin: true,
    };
  }

  const db = await getDb();
  const row = await db
    .prepare(
      "SELECT id, company_id FROM staff WHERE LOWER(email) = LOWER(?) LIMIT 1"
    )
    .get<{ id: number; company_id: number | null }>(identity);

  if (!row) return null;

  return {
    identity,
    staffId: row.id,
    companyId: row.company_id ?? 1,
    isPlatformAdmin: false,
  };
}

// Convenience for the common case: just the company_id, throwing if no
// session. Routes that already established auth via middleware can call
// this without re-checking for null.
export async function requireCompanyId(): Promise<number> {
  const ctx = await getSessionContext();
  if (!ctx) {
    throw new Error("No session");
  }
  return ctx.companyId;
}

export const SESSION_COOKIE = COOKIE_NAME;
