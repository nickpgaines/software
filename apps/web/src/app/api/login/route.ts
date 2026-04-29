import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "admin";

  if (username !== expectedUser || password !== expectedPass) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
