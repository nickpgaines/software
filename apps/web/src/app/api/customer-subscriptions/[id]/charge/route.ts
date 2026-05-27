import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription, type Payment } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { chargeSubscription } from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";

/**
 * Manually charge a subscription's saved card for the current due period —
 * "charge now" instead of waiting for the daily cron. Shares the exact billing
 * path as the auto-biller (lib/subscription-billing), so it advances the
 * schedule and is idempotent per period. Body: { amount_cents? } to override
 * the amount for this one charge.
 *
 * Returns the created payment row, or 402 + requires_action if the card needs
 * 3DS (the caller must then re-collect on-session).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

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

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
  }>;
  const amountCentsOverride =
    body.amount_cents !== undefined && Number.isFinite(Number(body.amount_cents))
      ? Number(body.amount_cents)
      : undefined;

  const result = await chargeSubscription(db, sub, { amountCentsOverride });

  if (result.ok && result.status === "charged") {
    const created = (await db
      .prepare("SELECT * FROM payments WHERE id = ? AND company_id = ?")
      .get(result.paymentId, companyId)) as Payment;
    return NextResponse.json(created, { status: 201 });
  }
  if (result.ok && result.status === "already_charged") {
    return NextResponse.json(
      { error: "This billing period has already been charged" },
      { status: 409 }
    );
  }
  if (result.ok && result.status === "skipped") {
    const msg =
      result.reason === "stripe_not_ready"
        ? "Connected Stripe account isn't ready to accept charges"
        : result.reason.startsWith("status_")
          ? `Subscription is not active (${result.reason.replace("status_", "")})`
          : "Nothing to charge";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!result.ok && result.status === "no_card") {
    return NextResponse.json(
      { error: "No saved card on file for this subscription's customer" },
      { status: 400 }
    );
  }
  // failed
  return NextResponse.json(
    {
      error: result.error,
      requires_action: result.requiresAction,
    },
    { status: result.requiresAction ? 402 : 400 }
  );
}
