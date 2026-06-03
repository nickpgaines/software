import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription, type Payment } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { chargeSubscription } from "@/lib/subscription-billing";
import { chargeStripeSubscriptionNow } from "@/lib/stripe-subscriptions";

export const dynamic = "force-dynamic";

/**
 * Manually charge a subscription off-cycle ("charge now") for the current
 * billing amount. For subs linked to a Stripe Subscription, this creates an
 * off-cycle invoice item + invoice on Stripe and immediately attempts payment,
 * so the charge shows on the same Stripe Sub's history. The recurring schedule
 * is unaffected. For legacy rows without a Stripe Sub, falls back to the
 * direct PaymentIntent path (the pre-Stripe-Sub billing model).
 *
 * Body: { amount_cents? } to override the amount for this one charge.
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

  if (sub.stripe_subscription_id) {
    const amount = Math.round(
      amountCentsOverride != null ? amountCentsOverride : sub.price_cents
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }
    const customer = await db
      .prepare("SELECT name FROM customers WHERE id = ? AND company_id = ?")
      .get<{ name: string | null }>(sub.customer_id, companyId);
    const description =
      `Subscription #${sub.id} (${sub.name}) — ${customer?.name ?? ""}`.trim();
    const result = await chargeStripeSubscriptionNow({
      companyId,
      stripeSubscriptionId: sub.stripe_subscription_id,
      amountCents: amount,
      description,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Record the Payment row optimistically so the UI sees it immediately.
    // The invoice.payment_succeeded webhook will dedupe via the PaymentIntent
    // ID (see handleSubscriptionInvoicePaid in /api/stripe/webhook/route.ts).
    const paymentDate = new Date().toISOString().slice(0, 10);
    const res = await db
      .prepare(
        `INSERT INTO payments
           (company_id, job_id, amount_cents, tip_cents, method, payment_date,
            notes, send_email, send_sms, stripe_payment_intent_id, source,
            subscription_id)
         VALUES (?, NULL, ?, 0, 'card', ?, ?, 0, 0, ?, 'subscription', ?)`
      )
      .run(
        companyId,
        amount,
        paymentDate,
        `Subscription #${sub.id} charge (Stripe invoice ${result.invoiceId})`,
        result.paymentIntentId,
        sub.id
      );
    const paymentId = Number(res.lastInsertRowid);
    const created = (await db
      .prepare("SELECT * FROM payments WHERE id = ? AND company_id = ?")
      .get(paymentId, companyId)) as Payment;
    return NextResponse.json(created, { status: 201 });
  }

  // Legacy path: rows that pre-date the Stripe Subscription model. These
  // shouldn't be created going forward, but the path stays for safety.
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
  return NextResponse.json(
    {
      error: result.error,
      requires_action: result.requiresAction,
    },
    { status: result.requiresAction ? 402 : 400 }
  );
}
