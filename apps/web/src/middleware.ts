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
  const secret = process.env.SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV === "production"
      ? null
      : "dev-secret-change-me");
  if (!secret) return false;
  let payload: string;
  try {
    payload = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return false;
  }
  const expected = await hmacSha256(secret, payload);
  return timingSafeEqual(sig, expected);
}

// Origin/Referer check for state-changing requests. Blocks classic CSRF where
// a third-party site tricks a logged-in user's browser into firing a POST at
// our API: such requests carry an Origin header pointing somewhere else.
// Webhooks and other cross-origin POSTs are excluded via the matcher below.
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  // Use the same host the request actually arrived at (respects proxies via
  // x-forwarded-host since NextRequest.nextUrl already accounts for it).
  const expectedHost = req.headers.get("host");
  if (!expectedHost) return false;
  const candidate = origin || referer;
  if (!candidate) {
    // Browsers send Origin on all cross-origin POSTs from <form> and fetch.
    // A missing Origin AND missing Referer on a state-changing request is
    // suspicious — treat as a fail-closed.
    return false;
  }
  try {
    const url = new URL(candidate);
    return url.host === expectedHost;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await isValid(token);

  // Public marketing pages — visible to everyone, no auth needed.
  // Logged-in users see them too (e.g. to compare pricing).
  if (pathname === "/") {
    return NextResponse.next();
  }

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    if (authed) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (UNSAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin request blocked" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|favicon.png|manifest.json|sw.js|icons/|privacy|terms|data-deletion|api/login|api/signup|api/auth/|api/messages/webhook|api/twilio/|api/voice/outbound|api/voice/status|api/voice/recording|api/email/unsubscribe|api/stripe/webhook|api/integrations/meta/webhook|invoices/pay/|api/invoices/pay/).*)",
  ],
};
