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

// Cookie payload format:
//   v1 (legacy):  `${username}:${ts}`
//   v2:           `${username}:${ts}:${staffId}:${companyId}`
// Both verify under the same HMAC. Reading code falls back gracefully when
// the v2 fields are absent, so existing v1 cookies stay valid.
type SessionTokenIds = {
  staffId?: number | null;
  companyId?: number | null;
};

export function createSessionToken(
  username: string,
  ids: SessionTokenIds = {}
) {
  const staff = ids.staffId == null ? "" : String(ids.staffId);
  const company = ids.companyId == null ? "" : String(ids.companyId);
  const payload = `${username}:${Date.now()}:${staff}:${company}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export type VerifiedSession = {
  username: string;
  staffId: number | null;
  companyId: number | null;
};

export function verifySessionToken(
  token: string | undefined
): VerifiedSession | null {
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
  const parts = payload.split(":");
  const username = parts[0];
  if (!username) return null;
  const staffRaw = parts[2];
  const companyRaw = parts[3];
  const staffId =
    staffRaw && /^\d+$/.test(staffRaw) ? Number(staffRaw) : null;
  const companyId =
    companyRaw && /^\d+$/.test(companyRaw) ? Number(companyRaw) : null;
  return { username, staffId, companyId };
}

export function getSessionUser(): string | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySessionToken(token)?.username ?? null;
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
  const token = cookies().get(COOKIE_NAME)?.value;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  const identity = verified.username;

  if (identity === ADMIN_USER()) {
    return {
      identity,
      staffId: null,
      companyId: 1,
      isPlatformAdmin: true,
    };
  }

  // Fast path: the cookie carries staffId + companyId for sessions issued
  // after the v2 cookie format landed. No DB round-trip required.
  if (verified.staffId != null && verified.companyId != null) {
    return {
      identity,
      staffId: verified.staffId,
      companyId: verified.companyId,
      isPlatformAdmin: false,
    };
  }

  // Legacy v1 cookie — look up the staff row to fill in IDs.
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
