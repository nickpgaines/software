import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getAppOrigin,
  syncAccountStatus,
} from "@/lib/stripe";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe OAuth redirect target. Stripe appends ?code=ac_xxx (success)
 * or ?error=... (failure). On success, exchange the code for the
 * connected account's id, store it, sync status, redirect into Settings.
 */
export async function GET(req: Request) {
  const origin = getAppOrigin(req);
  const settings = `${origin}/settings?tab=payments`;
  const url = new URL(req.url);

  const error = url.searchParams.get("error");
  if (error) {
    const desc =
      url.searchParams.get("error_description") || "Authorization denied";
    return NextResponse.redirect(
      `${settings}&connect_error=${encodeURIComponent(desc)}`
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${settings}&connect_error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.redirect(
      `${settings}&connect_error=${encodeURIComponent("Stripe is not configured")}`
    );
  }

  try {
    const stripe = getStripe();
    const token = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });
    const accountId = token.stripe_user_id;
    if (!accountId) {
      throw new Error("No stripe_user_id returned");
    }

    const db = await getDb();
    await db
      .prepare(
        "UPDATE company SET stripe_account_id = ?, stripe_account_type = 'standard', updated_at = datetime('now') WHERE id = 1"
      )
      .run(accountId);

    try {
      const account = await stripe.accounts.retrieve(accountId);
      await syncAccountStatus(accountId, account);
    } catch {
      // ignore — the dashboard will refresh on next status check
    }

    return NextResponse.redirect(settings);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth exchange failed";
    console.error("Stripe OAuth callback failed:", e);
    return NextResponse.redirect(
      `${settings}&connect_error=${encodeURIComponent(message)}`
    );
  }
}
