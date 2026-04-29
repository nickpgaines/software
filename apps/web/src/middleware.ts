import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "crm_session";
const encoder = new TextEncoder();

function hex(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return hex(sig);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isValid(token: string | undefined) {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  let payload: string;
  try {
    payload = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return false;
  }
  const expected = await hmacSha256(secret, payload);
  return timingSafeEqual(sig, expected);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await isValid(token);

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/login).*)"],
};
