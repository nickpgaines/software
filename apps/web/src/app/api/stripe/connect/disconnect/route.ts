import { NextResponse } from "next/server";
import { getDb, type Company } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Forget the connected Stripe account on this deployment.
 *
 * - Standard (OAuth): also call oauth.deauthorize so the user's Stripe
 *   dashboard reflects the disconnection from this platform.
 * - Express: just clear our DB row. Stripe doesn't allow platforms to
 *   delete merchant accounts — the user can rejoin later.
 */
export async function POST() {
  const db = await getDb();
  const company = (await db
    .prepare("SELECT * FROM company WHERE id = 1")
    .get()) as Company | undefined;

  if (
    company?.stripe_account_id &&
    company.stripe_account_type === "standard" &&
    isStripeConfigured() &&
    process.env.STRIPE_CONNECT_CLIENT_ID?.trim()
  ) {
    try {
      const stripe = getStripe();
      await stripe.oauth.deauthorize({
        client_id: process.env.STRIPE_CONNECT_CLIENT_ID!.trim(),
        stripe_user_id: company.stripe_account_id,
      });
    } catch (e) {
      // If deauthorize fails (already disconnected, etc.), still clear locally.
      console.error("oauth.deauthorize failed (continuing):", e);
    }
  }

  await db
    .prepare(
      `UPDATE company
         SET stripe_account_id = NULL,
             stripe_account_type = NULL,
             stripe_charges_enabled = 0,
             stripe_payouts_enabled = 0,
             stripe_details_submitted = 0,
             updated_at = datetime('now')
       WHERE id = 1`
    )
    .run();
  return NextResponse.json({ ok: true });
}
