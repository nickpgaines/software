import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  fetchCompanyInfo,
  getQuickbooksEnvironment,
  isQuickbooksConfigured,
  persistCompanyName,
  persistTokens,
} from "@/lib/quickbooks";
import { getAppOrigin } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = getAppOrigin(req);
  const settings = `${origin}/settings/integrations/quickbooks`;
  const url = new URL(req.url);

  const error = url.searchParams.get("error");
  if (error) {
    const desc =
      url.searchParams.get("error_description") || "Authorization denied";
    return NextResponse.redirect(
      `${settings}?connect_error=${encodeURIComponent(desc)}`
    );
  }

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  if (!code || !realmId) {
    return NextResponse.redirect(
      `${settings}?connect_error=${encodeURIComponent("Missing authorization code or realm ID")}`
    );
  }

  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("qb_oauth_state="))
    ?.split("=")[1];
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      `${settings}?connect_error=${encodeURIComponent("OAuth state mismatch")}`
    );
  }

  if (!isQuickbooksConfigured()) {
    return NextResponse.redirect(
      `${settings}?connect_error=${encodeURIComponent("QuickBooks is not configured")}`
    );
  }

  try {
    const redirectUri = `${origin}/api/quickbooks/connect/oauth-callback`;
    const env = getQuickbooksEnvironment();
    const token = await exchangeCodeForTokens(code, redirectUri);

    await persistTokens({
      realmId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: token.expires_in,
      environment: env,
    });

    try {
      const info = await fetchCompanyInfo(realmId, token.access_token, env);
      if (info.companyName) {
        await persistCompanyName(info.companyName);
      }
    } catch {
      // best-effort — connection still succeeds
    }

    const res = NextResponse.redirect(settings);
    res.cookies.set("qb_oauth_state", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth exchange failed";
    console.error("QuickBooks OAuth callback failed:", e);
    return NextResponse.redirect(
      `${settings}?connect_error=${encodeURIComponent(message)}`
    );
  }
}
