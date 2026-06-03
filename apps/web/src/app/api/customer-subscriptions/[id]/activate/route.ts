import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";

export const dynamic = "force-dynamic";

/**
 * Manual activation override. Lets a merchant flip a pending subscription to
 * active WITHOUT going through the customer-facing accept flow (signature +
 * card on file + Stripe Subscription). Intended for one-off arrangements
 * where the customer pays out-of-band (cash, check, separate invoice) and
 * doesn't want a card on file.
 *
 * Status='active' is still the source-of-truth for "the agreement is live",
 * but a manually-activated row has no stripe_subscription_id — so the
 * automatic Stripe billing schedule won't run. Merchants are expected to
 * collect payment via their own process (or use Forge's manual "Charge now"
 * button on a customer who later does add a card).
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const sub = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(Number(params.id), companyId)) as CustomerSubscription | undefined;
  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }
  if (sub.status === "active") {
    return NextResponse.json(sub);
  }
  if (sub.status === "canceled" || sub.status === "declined") {
    return NextResponse.json(
      { error: `Subscription is ${sub.status} — cannot reactivate manually` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET status = 'active',
             accepted_at = COALESCE(accepted_at, ?)
       WHERE id = ? AND company_id = ?`
    )
    .run(now, sub.id, companyId);

  try {
    await ensureRollingVisits(db, {
      subscriptionId: sub.id,
      customerId: sub.customer_id,
      companyId,
      startDateIso: startDateToIso(sub.start_date || now),
      serviceInterval: sub.service_interval,
      pricePerVisitCents: sub.price_cents,
      visitName: sub.name,
      visitDescription: sub.description,
      soldById: sub.sold_by_id,
      technicianId: null,
    });
  } catch (e) {
    console.error(
      `ensureRollingVisits failed during manual activation of sub ${sub.id}:`,
      e
    );
  }

  const updated = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ?"
    )
    .get(sub.id, companyId)) as CustomerSubscription;
  return NextResponse.json(updated);
}
