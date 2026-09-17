import { NextResponse, type NextRequest } from "next/server";
import { isWidgetBearerRoute } from "./lib/widget-http";
import {
  billingOrigin,
  isForgeBillingEnabled,
} from "./lib/forge-billing/config";

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

const INTERNAL_CONTEXT_HEADERS = [
  "x-company-id",
  "x-forge-internal",
  "x-forge-billing-internal",
];

function nextWithoutInternalContext(req: NextRequest) {
  const headers = new Headers(req.headers);
  for (const name of INTERNAL_CONTEXT_HEADERS) headers.delete(name);
  return NextResponse.next({ request: { headers } });
}

function exactOrChild(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function isPublicForgeBillingPath(pathname: string, method: string) {
  return (
    (method === "GET" && pathname === "/api/forge-billing/public") ||
    (method === "POST" && pathname === "/api/forge-billing/webhook")
  );
}

export function isForgeBillingSafePath(pathname: string, method: string) {
  if (pathname === "/billing" || exactOrChild(pathname, "/billing")) return true;
  if (exactOrChild(pathname, "/api/forge-billing")) return true;
  if (pathname === "/api/me" || pathname === "/api/logout") return true;
  if (pathname === "/api/account/deletion") return true;
  if (pathname === "/api/widget/token" && method === "DELETE") return true;
  if (pathname === "/support" || exactOrChild(pathname, "/support")) return true;
  if (method === "GET" && pathname === "/api/stripe/terminal/attempts") return true;
  if (
    method === "POST" &&
    /^\/api\/stripe\/terminal\/attempts\/[^/]+\/(?:reconcile|cancel)$/.test(
      pathname
    )
  ) {
    return true;
  }
  return (
    method === "POST" &&
    /^\/api\/jobs\/[^/]+\/payments\/stripe-confirm$/.test(pathname)
  );
}

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

  if (isPublicForgeBillingPath(pathname, req.method)) {
    return nextWithoutInternalContext(req);
  }

  // Scheduled lifecycle delivery authenticates with CRON_SECRET in its handler.
  if (pathname === "/api/cron/job-lifecycle-notifications" && (req.method === "GET" || req.method === "POST")) {
    return nextWithoutInternalContext(req);
  }

  // MCP connector endpoint authenticates via OAuth bearer token, not the
  // cookie session. Skip the cookie check so Claude (which has no cookie)
  // can reach it; the route handler enforces auth itself.
  if (pathname === "/api/mcp") {
    return nextWithoutInternalContext(req);
  }

  // WidgetKit refreshes in the background without the web session cookie.
  // These two operations authenticate their scoped bearer token in the route.
  if (isWidgetBearerRoute(req)) {
    return nextWithoutInternalContext(req);
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await isValid(token);

  // Public marketing pages — visible to everyone, no auth needed.
  // Logged-in users see them too (e.g. to compare pricing).
  if (pathname === "/") {
    return nextWithoutInternalContext(req);
  }

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    if (authed) return NextResponse.redirect(new URL("/dashboard", req.url));
    return nextWithoutInternalContext(req);
  }

  if (!authed) {
    // API routes should return 401, not redirect to /login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (UNSAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin request blocked" },
      { status: 403 }
    );
  }

  if (!isForgeBillingEnabled() || isForgeBillingSafePath(pathname, req.method)) {
    return nextWithoutInternalContext(req);
  }

  let origin: string;
  try {
    origin = billingOrigin();
  } catch {
    return NextResponse.json(
      { error: "billing_access_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let accessResponse: Response;
  try {
    accessResponse = await fetch(`${origin}/api/forge-billing/access`, {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") || "",
        accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "billing_access_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (accessResponse.status === 401) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.redirect(`${origin}/login`);
  }
  if (!accessResponse.ok) {
    return NextResponse.json(
      { error: "billing_access_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let access: { allowed?: unknown; reason?: unknown };
  try {
    access = (await accessResponse.json()) as {
      allowed?: unknown;
      reason?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "billing_access_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (access.allowed === true) return nextWithoutInternalContext(req);
  if (access.allowed !== false || typeof access.reason !== "string") {
    return NextResponse.json(
      { error: "billing_access_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: access.reason, reason: access.reason },
      { status: 402, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.redirect(`${origin}/billing`);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|favicon.png|manifest.json|sw.js|icons/|privacy|terms|sms-terms|sms-consent|sms-opt-in|about|support|data-deletion|connect-claude|\\.well-known/|api/login|api/signup|api/auth/|api/messages/webhook|api/twilio/|api/voice/outbound|api/voice/status|api/voice/recording|api/email/unsubscribe|api/stripe/webhook|api/integrations/meta/webhook|api/mcp/oauth/register|api/mcp/oauth/token|api/mcp/oauth/revoke|invoices/pay/|api/invoices/pay/|estimates/accept/|api/estimates/accept/|subscriptions/accept/|api/subscriptions/accept/).*)",
  ],
};
