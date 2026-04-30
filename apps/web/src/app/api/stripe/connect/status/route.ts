import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  syncAccountStatus,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Returns the connection status for the Settings UI. Re-pulls from
 * Stripe so the UI reflects the most up-to-date capability flags.
 */
export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });
  }

  try {
    const company = await getCompany();
    if (!company.stripe_account_id) {
      return NextResponse.json({
        configured: true,
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(company.stripe_account_id);
    await syncAccountStatus(company.stripe_account_id, account);

    return NextResponse.json({
      configured: true,
      connected: true,
      account_id: company.stripe_account_id,
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
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("GET /api/stripe/connect/status failed:", e);
    return NextResponse.json(
      { error: `Could not load Stripe status: ${message}` },
      { status: 500 }
    );
  }
}
