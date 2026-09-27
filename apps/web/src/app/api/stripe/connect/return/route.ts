import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getAppOrigin,
} from "@/lib/stripe";
import { requireCompanyId } from "@/lib/auth";
import {getDb} from '@/lib/db';

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
    const companyId = await requireCompanyId();
    const company = await getCompany(companyId);
    if (company.stripe_account_id) {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(company.stripe_account_id);
      if(account.id===company.stripe_account_id) {
        // A delayed return may belong to an account that was disconnected or
        // replaced during the provider request. Never restore that old binding.
        await (await getDb()).prepare(`UPDATE company SET stripe_charges_enabled=?,stripe_payouts_enabled=?,stripe_details_submitted=?,updated_at=datetime('now') WHERE id=? AND stripe_account_id=?`)
          .run(account.charges_enabled?1:0,account.payouts_enabled?1:0,account.details_submitted?1:0,companyId,account.id);
      }
    }
  } catch (e) {
    console.error("GET /api/stripe/connect/return sync failed:", e);
  }

  return NextResponse.redirect(settings);
}
