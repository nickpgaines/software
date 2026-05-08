import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { getDb, syncReplica, type Staff } from "@/lib/db";
import { OAUTH_STATE_COOKIE, verifyOAuthState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

// Errors that should also clear the existing session cookie. The user
// completed Google's auth challenge intending to switch into a specific
// account; if we can't honor that intent, we must NOT silently leave them
// signed in as whoever they were before — the middleware would then bounce
// them off /login and back into the wrong dashboard with no error visible.
const ERRORS_THAT_END_SESSION = new Set([
  "no_matching_staff",
  "google_email_unverified",
]);

function loginError(req: Request, code: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", code);
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  if (ERRORS_THAT_END_SESSION.has(code)) {
    res.cookies.delete(SESSION_COOKIE);
  }
  return res;
}

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return loginError(req, "google_not_configured");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookieHeader = req.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return loginError(req, "oauth_state_mismatch");
  }
  if (!verifyOAuthState(stateCookie, "google")) {
    return loginError(req, "oauth_state_invalid");
  }

  const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || req.url;
  const redirectUri = new URL("/api/auth/google/callback", baseUrl).toString();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return loginError(req, "google_token_exchange_failed");
  }
  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenJson.access_token) {
    return loginError(req, "google_token_exchange_failed");
  }

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) {
    return loginError(req, "google_userinfo_failed");
  }
  const user = (await userRes.json()) as GoogleUserInfo;
  const providerUserId = user.sub;
  const email = user.email?.trim().toLowerCase();
  if (!providerUserId || !email || user.email_verified !== true) {
    return loginError(req, "google_email_unverified");
  }
  const sub: string = providerUserId;
  const verifiedEmail: string = email;

  const db = await getDb();

  // Prefer an existing oauth_accounts link; otherwise match by staff email.
  async function resolveStaff(): Promise<Staff | undefined> {
    const link = (await db
      .prepare(
        "SELECT staff_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ? LIMIT 1"
      )
      .get("google", sub)) as { staff_id: number } | undefined;
    if (link) {
      return (await db
        .prepare("SELECT * FROM staff WHERE id = ? LIMIT 1")
        .get(link.staff_id)) as Staff | undefined;
    }
    const byEmail = (await db
      .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
      .get(verifiedEmail)) as Staff | undefined;
    if (byEmail) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO oauth_accounts (provider, provider_user_id, staff_id, email) VALUES (?, ?, ?, ?)"
        )
        .run("google", sub, byEmail.id, verifiedEmail);
    }
    return byEmail;
  }

  let staff = await resolveStaff();
  // The function instance handling this OAuth callback may be running
  // against a stale embedded replica that doesn't yet show recent
  // signups or oauth_accounts links. Force a sync and retry once before
  // declaring no match — same pattern as /api/login.
  if (!staff) {
    await syncReplica();
    staff = await resolveStaff();
  }

  if (!staff) {
    return loginError(req, "no_matching_staff");
  }

  const identity = staff.email || verifiedEmail;
  const token = createSessionToken(identity, {
    staffId: staff.id,
    companyId: staff.company_id ?? 1,
  });
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
