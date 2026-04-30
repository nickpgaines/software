import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Forget the connected Stripe account on this deployment. The Express
 * account itself isn't deleted on Stripe's side (Stripe doesn't allow
 * platforms to delete merchant accounts) — the user can rejoin later
 * from the same email.
 */
export async function POST() {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE company
         SET stripe_account_id = NULL,
             stripe_charges_enabled = 0,
             stripe_payouts_enabled = 0,
             stripe_details_submitted = 0,
             updated_at = datetime('now')
       WHERE id = 1`
    )
    .run();
  return NextResponse.json({ ok: true });
}
