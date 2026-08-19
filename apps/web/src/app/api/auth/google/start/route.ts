import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canStartGoogleOAuth, NATIVE_APP_COOKIE } from "@/lib/native-auth";
import { OAUTH_STATE_COOKIE, createOAuthState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!canStartGoogleOAuth(cookies().get(NATIVE_APP_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", req.url)
    );
  }

  const state = createOAuthState("google");
  const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || req.url;
  const redirectUri = new URL("/api/auth/google/callback", baseUrl).toString();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
