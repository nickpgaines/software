import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getDb, type Staff } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  if (!password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const envUser = process.env.ADMIN_USERNAME?.trim();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  const isProd = process.env.NODE_ENV === "production";
  // In production we refuse to honor the built-in admin login unless BOTH
  // env vars are explicitly set — no insecure "admin/admin" defaults.
  const adminEnabled = isProd ? !!(envUser && envPass) : true;
  const expectedUser = envUser || (isProd ? "" : "admin");
  const expectedPass = envPass || (isProd ? "" : "admin");

  // Built-in admin login (env-vars).
  if (
    adminEnabled &&
    expectedUser &&
    expectedPass &&
    username === expectedUser &&
    password === expectedPass
  ) {
    return issueSession(username, { staffId: null, companyId: 1 });
  }

  // Staff login (email + scrypt-hashed password from the staff table).
  const identifier = (username || "").trim().toLowerCase();
  if (identifier) {
    const db = await getDb();
    const row = (await db
      .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
      .get(identifier)) as Staff | undefined;
    if (row && row.password_hash && verifyPassword(password, row.password_hash)) {
      return issueSession(row.email || identifier, {
        staffId: row.id,
        companyId: row.company_id ?? 1,
      });
    }
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}

function issueSession(
  identity: string,
  ids: { staffId: number | null; companyId: number | null }
) {
  const token = createSessionToken(identity, ids);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
