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

  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "admin";

  // Built-in admin login (env-vars).
  if (username === expectedUser && password === expectedPass) {
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
      return issueSession(row.email || identifier);
    }
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}

function issueSession(identity: string) {
  const token = createSessionToken(identity);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
