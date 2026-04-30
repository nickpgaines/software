import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getAppOrigin,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe redirects here when an onboarding link expires or the user
 * needs to refresh — mint a fresh link and bounce them back into the
 * flow.
 */
export async function GET(req: Request) {
  const origin = getAppOrigin(req);
  const settings = `${origin}/settings?tab=payments`;

  if (!isStripeConfigured()) return NextResponse.redirect(settings);

  try {
    const company = await getCompany();
    if (!company.stripe_account_id) return NextResponse.redirect(settings);

    const stripe = getStripe();
    const link = await stripe.accountLinks.create({
      account: company.stripe_account_id,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/api/stripe/connect/return`,
      type: "account_onboarding",
    });
    return NextResponse.redirect(link.url);
  } catch (e) {
    console.error("GET /api/stripe/connect/refresh failed:", e);
    return NextResponse.redirect(settings);
  }
}
