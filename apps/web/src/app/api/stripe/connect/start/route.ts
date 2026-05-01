import { NextResponse } from "next/server";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getAppOrigin,
  syncAccountStatus,
} from "@/lib/stripe";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Begin Stripe Connect onboarding. Creates an Express account if one
 * doesn't exist yet, then mints a one-time onboarding link the user is
 * redirected to. After they finish (or bail), Stripe sends them back to
 * /api/stripe/connect/return.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured on the server" },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripe();
    const company = await getCompany();
    const origin = getAppOrigin(req);

    let accountId = company.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: company.name
          ? { name: company.name }
          : undefined,
      });
      accountId = account.id;
      const db = await getDb();
      await db
        .prepare(
          "UPDATE company SET stripe_account_id = ?, stripe_account_type = 'express', updated_at = datetime('now') WHERE id = 1"
        )
        .run(accountId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/api/stripe/connect/return`,
      type: "account_onboarding",
    });

    // Best-effort status sync now in case the account already existed.
    try {
      const account = await stripe.accounts.retrieve(accountId);
      await syncAccountStatus(accountId, account);
    } catch {
      // ignore
    }

    return NextResponse.json({ url: link.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("POST /api/stripe/connect/start failed:", e);
    return NextResponse.json(
      { error: `Could not start Stripe onboarding: ${message}` },
      { status: 500 }
    );
  }
}
