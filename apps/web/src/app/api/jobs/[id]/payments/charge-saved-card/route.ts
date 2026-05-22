import { NextResponse } from "next/server";
import { getDb, type Payment, type StripePaymentMethod } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { autoCompleteSteps } from "@/lib/jobs";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";
import { sendPaymentReceipt } from "@/lib/payment-receipts";

export const dynamic = "force-dynamic";

/**
 * Charge a card already saved on file (off-session) for a specific job.
 * Body: {
 *   amount_cents: number,
 *   tip_cents?: number,
 *   payment_method_id?: number, // our DB row id; defaults to customer's default
 *   subscription_id?: number,   // optional link if this charge fulfills a sub period
 *   notes?: string,
 *   send_email?: boolean,
 *   send_sms?: boolean,
 * }
 *
 * Errors surface as 402 with `requires_action: true` if the card needs
 * 3DS — the caller should re-collect the card with the regular
 * on-session PaymentElement flow in that case.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured" },
      { status: 503 }
    );
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      {
        error:
          "Connected Stripe account isn't ready to accept charges. Check Settings → Payments.",
      },
      { status: 400 }
    );
  }

  const db = await getDb();
  const jobId = Number(params.id);
  const job = (await db
    .prepare(
      "SELECT j.id, j.customer_id, c.name, c.email FROM jobs j JOIN customers c ON c.id = j.customer_id WHERE j.id = ? AND j.company_id = ?"
    )
    .get(jobId, companyId)) as
    | { id: number; customer_id: number; name: string | null; email: string | null }
    | undefined;
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
    tip_cents: number;
    payment_method_id: number;
    subscription_id: number | null;
    notes: string | null;
    send_email: boolean;
    send_sms: boolean;
  }>;

  const amount = Math.round(Number(body.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 }
    );
  }
  const tip = Math.round(Number(body.tip_cents ?? 0));
  if (!Number.isFinite(tip) || tip < 0) {
    return NextResponse.json(
      { error: "Tip must be zero or greater" },
      { status: 400 }
    );
  }
  const total = amount + tip;

  // Pick the PM: explicit id wins, otherwise the customer's default.
  let pm: StripePaymentMethod | undefined;
  if (body.payment_method_id) {
    pm = (await db
      .prepare(
        "SELECT * FROM stripe_payment_methods WHERE id = ? AND company_id = ? AND customer_id = ? LIMIT 1"
      )
      .get(Number(body.payment_method_id), companyId, job.customer_id)) as
      | StripePaymentMethod
      | undefined;
  } else {
    pm = (await db
      .prepare(
        `SELECT * FROM stripe_payment_methods
         WHERE company_id = ? AND customer_id = ?
         ORDER BY is_default DESC, created_at DESC, id DESC LIMIT 1`
      )
      .get(companyId, job.customer_id)) as StripePaymentMethod | undefined;
  }
  if (!pm) {
    return NextResponse.json(
      { error: "No saved card on file for this customer" },
      { status: 400 }
    );
  }

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((total * feeBps) / 10_000)
      : 0;

  const stripe = getStripe();
  let intent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: total,
        currency: "usd",
        customer: pm.stripe_customer_id,
        payment_method: pm.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `Job #${jobId} — ${job.name ?? "Customer"} (saved card)`,
        metadata: {
          job_id: String(jobId),
          customer_id: String(job.customer_id),
          amount_cents: String(amount),
          tip_cents: String(tip),
          application_fee_cents: String(applicationFee),
          subscription_id:
            body.subscription_id ? String(body.subscription_id) : "",
          source: "saved_card",
        },
        receipt_email: job.email || undefined,
        ...(applicationFee > 0
          ? { application_fee_amount: applicationFee }
          : {}),
      },
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    // Stripe throws on declines, including 3DS required. Surface the
    // `requires_action` case as a 402 so the UI can fall back to an
    // on-session collection flow.
    const err = e as { code?: string; message?: string; payment_intent?: { id?: string; status?: string } };
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
        payment_intent_id: intent.id,
      },
      { status: intent.status === "requires_action" ? 402 : 400 }
    );
  }

  const send_email = body.send_email ? 1 : 0;
  const send_sms = body.send_sms ? 1 : 0;
  const payment_date = new Date().toISOString().slice(0, 10);
  const notes = body.notes ? String(body.notes) : null;
  const subscriptionId =
    body.subscription_id != null && Number(body.subscription_id) > 0
      ? Number(body.subscription_id)
      : null;

  const insertedId = await db.transaction(async (tx) => {
    const result = await tx
      .prepare(
        `INSERT INTO payments
           (company_id, job_id, amount_cents, tip_cents, method, payment_date, notes,
            send_email, send_sms, stripe_payment_intent_id, subscription_id)
         VALUES (?, ?, ?, ?, 'card', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        companyId,
        jobId,
        amount,
        tip,
        payment_date,
        notes,
        send_email,
        send_sms,
        intent.id,
        subscriptionId
      );
    await autoCompleteSteps(tx, jobId, companyId);
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
      tipCents: created.tip_cents ?? 0,
      method: "card",
      paymentDate: created.payment_date || payment_date,
      sendEmail: !!send_email,
      sendSms: !!send_sms,
    });
  }

  return NextResponse.json(created, { status: 201 });
}
