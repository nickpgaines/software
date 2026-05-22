import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import {
  isStripeConfigured,
  getCompany,
  getOrCreateTerminalLocation,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Return (and lazily create) the Stripe Terminal Location for this
 * tenant's connected account. Tap to Pay PaymentIntents must reference
 * this Location. The mobile app calls this once at startup and caches
 * the result.
 */
export async function GET() {
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
      { error: "Connect a Stripe account first" },
      { status: 400 }
    );
  }
  const loc = await getOrCreateTerminalLocation(
    companyId,
    company.stripe_account_id
  );
  return NextResponse.json({
    location_id: loc.stripe_terminal_location_id,
    display_name: loc.display_name,
    stripe_account: company.stripe_account_id,
  });
}
