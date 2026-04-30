import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getAppOrigin,
  syncAccountStatus,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe sends the user here after they finish (or abandon) onboarding.
 * Pull the latest account status, persist it, then redirect into the
 * Settings → Payments tab.
 */
export async function GET(req: Request) {
  const origin = getAppOrigin(req);
  const settings = `${origin}/settings?tab=payments`;

  if (!isStripeConfigured()) return NextResponse.redirect(settings);

  try {
    const company = await getCompany();
    if (company.stripe_account_id) {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(company.stripe_account_id);
      await syncAccountStatus(company.stripe_account_id, account);
    }
  } catch (e) {
    console.error("GET /api/stripe/connect/return sync failed:", e);
  }

  return NextResponse.redirect(settings);
}
