import { NextResponse } from "next/server";
import {
  getDb,
  type CustomerSubscription,
  type Payment,
  type StripePaymentMethod,
} from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";
import { sendPaymentReceipt } from "@/lib/payment-receipts";

export const dynamic = "force-dynamic";

/**
 * Charge a subscription's saved default card off-session for one billing
 * period. Body: { amount_cents?: number, job_id?: number, send_email?: boolean, send_sms?: boolean }.
 *   - amount_cents defaults to the subscription's price_cents
 *   - job_id defaults to the next scheduled visit for the subscription
 *     (so the payment row anchors to a job, satisfying the FK)
 *
 * Returns the created payment row, or 402 + requires_action if the card
 * needs 3DS — in that case the caller must re-collect on-session.
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
  const company = await getCompany(companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      { error: "Connected Stripe account isn't ready to accept charges" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const subId = Number(params.id);
  const sub = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(subId, companyId)) as CustomerSubscription | undefined;
  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }
  if (sub.status !== "active") {
    return NextResponse.json(
      { error: `Subscription is not active (status: ${sub.status})` },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
    job_id: number;
    send_email: boolean;
    send_sms: boolean;
  }>;

  const amount = Math.round(
    Number.isFinite(Number(body.amount_cents))
      ? Number(body.amount_cents)
      : sub.price_cents
  );
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 }
    );
  }

  // Pick a job to anchor the payment row to. Prefer the next upcoming
  // visit; fall back to the most recent visit if no future one exists.
  let jobId = Number(body.job_id);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    const nextJob = (await db
      .prepare(
        `SELECT id FROM jobs
         WHERE company_id = ? AND subscription_id = ? AND scheduled_at >= datetime('now')
         ORDER BY scheduled_at ASC LIMIT 1`
      )
      .get(companyId, sub.id)) as { id: number } | undefined;
    const fallbackJob = nextJob
      ? null
      : ((await db
          .prepare(
            `SELECT id FROM jobs
             WHERE company_id = ? AND subscription_id = ?
             ORDER BY scheduled_at DESC LIMIT 1`
          )
          .get(companyId, sub.id)) as { id: number } | undefined);
    const resolved = nextJob || fallbackJob;
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            "No visits exist yet for this subscription to attach the payment to. Schedule a visit first or pass an explicit job_id.",
        },
        { status: 400 }
      );
    }
    jobId = resolved.id;
  } else {
    // Validate caller-provided job_id belongs to this sub & tenant.
    const job = await db
      .prepare(
        "SELECT id FROM jobs WHERE id = ? AND company_id = ? AND subscription_id = ?"
      )
      .get(jobId, companyId, sub.id);
    if (!job) {
      return NextResponse.json(
        { error: "job_id does not belong to this subscription" },
        { status: 400 }
      );
    }
  }

  // Resolve PM: explicit default on the subscription if set, otherwise
  // the customer's default saved card.
  let pm: StripePaymentMethod | undefined;
  if (sub.default_payment_method_id) {
    pm = (await db
      .prepare(
        "SELECT * FROM stripe_payment_methods WHERE company_id = ? AND stripe_payment_method_id = ? LIMIT 1"
      )
      .get(companyId, sub.default_payment_method_id)) as
      | StripePaymentMethod
      | undefined;
  }
  if (!pm) {
    pm = (await db
      .prepare(
        `SELECT * FROM stripe_payment_methods
         WHERE company_id = ? AND customer_id = ?
         ORDER BY is_default DESC, created_at DESC, id DESC LIMIT 1`
      )
      .get(companyId, sub.customer_id)) as StripePaymentMethod | undefined;
  }
  if (!pm) {
    return NextResponse.json(
      { error: "No saved card on file for this subscription's customer" },
      { status: 400 }
    );
  }

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((amount * feeBps) / 10_000)
      : 0;

  const customer = (await db
    .prepare(
      "SELECT name, email FROM customers WHERE id = ? AND company_id = ?"
    )
    .get(sub.customer_id, companyId)) as
    | { name: string | null; email: string | null }
    | undefined;

  const stripe = getStripe();
  let intent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        customer: pm.stripe_customer_id,
        payment_method: pm.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `Subscription #${sub.id} (${sub.name}) — ${customer?.name ?? ""}`.trim(),
        metadata: {
          subscription_id: String(sub.id),
          customer_id: String(sub.customer_id),
          job_id: String(jobId),
          amount_cents: String(amount),
          tip_cents: "0",
          application_fee_cents: String(applicationFee),
          source: "subscription",
        },
        receipt_email: customer?.email || undefined,
        ...(applicationFee > 0
          ? { application_fee_amount: applicationFee }
          : {}),
      },
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    const err = e as {
      code?: string;
      message?: string;
      payment_intent?: { id?: string; status?: string };
    };
    const requiresAction =
      err.code === "authentication_required" ||
      err.payment_intent?.status === "requires_action";
    return NextResponse.json(
      {
        error: err.message || "Card was declined",
        requires_action: requiresAction,
        payment_intent_id: err.payment_intent?.id,
      },
      { status: requiresAction ? 402 : 400 }
    );
  }

  if (intent.status !== "succeeded") {
    return NextResponse.json(
      {
        error: `Charge did not succeed (status: ${intent.status})`,
        requires_action: intent.status === "requires_action",
      },
      { status: intent.status === "requires_action" ? 402 : 400 }
    );
  }

  const send_email = body.send_email ? 1 : 0;
  const send_sms = body.send_sms ? 1 : 0;
  const payment_date = new Date().toISOString().slice(0, 10);

  const insertedId = await db.transaction(async (tx) => {
    const result = await tx
      .prepare(
        `INSERT INTO payments
           (company_id, job_id, amount_cents, tip_cents, method, payment_date, notes,
            send_email, send_sms, stripe_payment_intent_id, source, subscription_id)
         VALUES (?, ?, ?, 0, 'card', ?, ?, ?, ?, ?, 'subscription', ?)`
      )
      .run(
        companyId,
        jobId,
        amount,
        payment_date,
        `Subscription #${sub.id} charge`,
        send_email,
        send_sms,
        intent.id,
        sub.id
      );
    await tx
      .prepare(
        `UPDATE customer_subscriptions
           SET last_charged_at = datetime('now')
         WHERE id = ? AND company_id = ?`
      )
      .run(sub.id, companyId);
    return Number(result.lastInsertRowid);
  });

  const created = (await db
    .prepare("SELECT * FROM payments WHERE id = ? AND company_id = ?")
    .get(insertedId, companyId)) as Payment;

  if (send_email || send_sms) {
    await sendPaymentReceipt({
      jobId,
      paymentId: created.id,
      companyId,
      amountCents: created.amount_cents,
      tipCents: 0,
      method: "card",
      paymentDate: created.payment_date || payment_date,
      sendEmail: !!send_email,
      sendSms: !!send_sms,
    });
  }

  return NextResponse.json(created, { status: 201 });
}
