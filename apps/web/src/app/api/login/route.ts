import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getDb, type Staff } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import {
  checkLoginRate,
  clientIp,
  recordLoginAttempt,
} from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rate = await checkLoginRate(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  if (!password) {
    await recordLoginAttempt(ip, false);
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
    await recordLoginAttempt(ip, true);
    return issueSession(username);
  }

  // Staff login (email + scrypt-hashed password from the staff table).
  const identifier = (username || "").trim().toLowerCase();
  if (identifier) {
    const db = await getDb();
    const row = (await db
      .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
      .get(identifier)) as Staff | undefined;
    if (row && row.password_hash && verifyPassword(password, row.password_hash)) {
      await recordLoginAttempt(ip, true);
      return issueSession(row.email || identifier);
    }
  }

  await recordLoginAttempt(ip, false);
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}

function issueSession(identity: string) {
  const token = createSessionToken(identity);
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
