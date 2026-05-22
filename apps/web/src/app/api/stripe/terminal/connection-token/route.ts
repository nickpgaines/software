import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived Stripe Terminal ConnectionToken for a Tap to Pay
 * on iPhone (or any Terminal) reader to authenticate against the
 * merchant's connected Stripe account.
 *
 * The native iOS app fetches this on demand and hands it to
 * `STPTerminal.shared.discoverReaders(...)` etc.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      {
        error:
          "Connect a Stripe account in Settings → Payments before using Tap to Pay.",
      },
      { status: 400 }
    );
  }
  if (!company.stripe_charges_enabled) {
    return NextResponse.json(
      {
        error:
          "Stripe is still verifying this account. Finish onboarding before using Tap to Pay.",
      },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const token = await stripe.terminal.connectionTokens.create(
    {},
    { stripeAccount: company.stripe_account_id }
  );

  return NextResponse.json({
    secret: token.secret,
    stripe_account: company.stripe_account_id,
  });
}
