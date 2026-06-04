import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  syncAccountStatus,
} from "@/lib/stripe";
import { requireCompanyId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Returns the connection status for the Settings UI. Re-pulls from
 * Stripe so the UI reflects the most up-to-date capability flags.
 *
 * If the stored stripe_account_id is no longer accessible to the
 * platform key (revoked Connect authorization, deleted account, key
 * rotated to a different platform), we treat that as "not connected"
 * AND clear the stale ID from the company row so the UI shows the
 * Connect buttons. Without this the merchant gets stuck on an error
 * page with no way back.
 */
export async function GET() {
  const oauthConfigured = !!process.env.STRIPE_CONNECT_CLIENT_ID?.trim();

  if (!isStripeConfigured()) {
    return NextResponse.json({
      configured: false,
      oauth_configured: oauthConfigured,
      connected: false,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json({
      configured: true,
      oauth_configured: oauthConfigured,
      connected: false,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });
  }

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(company.stripe_account_id);
    await syncAccountStatus(companyId, company.stripe_account_id, account);

    return NextResponse.json({
      configured: true,
      oauth_configured: oauthConfigured,
      connected: true,
      account_id: company.stripe_account_id,
      account_type: company.stripe_account_type || "express",
      email: account.email || null,
      business_name:
        account.business_profile?.name ||
        account.settings?.dashboard?.display_name ||
        null,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
      requirements_due:
        (account.requirements?.currently_due?.length ?? 0) > 0 ||
        (account.requirements?.past_due?.length ?? 0) > 0,
    });
  } catch (e) {
    const err = e as {
      type?: string;
      code?: string;
      raw?: { type?: string; code?: string };
      message?: string;
    };
    const type = err.type || err.raw?.type || "";
    const code = err.code || err.raw?.code || "";
    const message = err.message || "Unknown error";

    // If the stored account is no longer accessible — Connect access
    // revoked, account deleted, or the platform key was rotated — clear
    // the stale ID and report as disconnected so the merchant can
    // reconnect. Any other error (network blip, Stripe outage) bubbles up.
    const isInaccessible =
      type === "StripePermissionError" ||
      type === "invalid_request_error" ||
      code === "permission_error" ||
      code === "resource_missing" ||
      code === "account_invalid";

    if (isInaccessible) {
      try {
        const db = await getDb();
        await db
          .prepare(
            `UPDATE company
               SET stripe_account_id = NULL,
                   stripe_charges_enabled = 0,
                   stripe_payouts_enabled = 0,
                   stripe_details_submitted = 0,
                   updated_at = datetime('now')
             WHERE id = ?`
          )
          .run(companyId);
      } catch (clearErr) {
        console.error(
          "Failed to clear stale stripe_account_id after permission error:",
          clearErr
        );
      }
      return NextResponse.json({
        configured: true,
        oauth_configured: oauthConfigured,
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        recovered_from:
          "The previously connected Stripe account is no longer accessible (authorization revoked or account removed). Reconnect to continue.",
      });
    }

    console.error("GET /api/stripe/connect/status failed:", e);
    return NextResponse.json(
      { error: `Could not load Stripe status: ${message}` },
      { status: 500 }
    );
  }
}
