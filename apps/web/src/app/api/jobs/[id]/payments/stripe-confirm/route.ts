import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  autoCompleteSteps,
  preparePaymentCompletionNotification,
  dispatchPaymentCompletionNotification,
} from "@/lib/payment-job-completion";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";
import { sendPaymentReceipt } from "@/lib/payment-receipts";
import { requireIdempotencyKey, insertPaymentIdempotently, paymentRequestFingerprint, PaymentIdempotencyError } from "@/lib/payment-idempotency";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    requireIdempotencyKey(req);
    return await confirmPayment(req, context);
  } catch (error) {
    if (error instanceof PaymentIdempotencyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

async function confirmPayment(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured on the server" },
      { status: 503 }
    );
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      { error: "No connected Stripe account" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const jobId = Number(params.id);

  const job = await db
    .prepare("SELECT id FROM jobs WHERE id = ? AND company_id = ?")
    .get(jobId, companyId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    payment_intent_id: string;
    notes: string | null;
    send_email: boolean | number;
    send_sms: boolean | number;
  }>;

  const intentId = String(body.payment_intent_id || "");
  if (!intentId) {
    return NextResponse.json(
      { error: "payment_intent_id is required" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  // Direct charges live on the connected account, so we must retrieve
  // the intent with the same Stripe-Account header.
  const intent = await stripe.paymentIntents.retrieve(
    intentId,
    undefined,
    { stripeAccount: company.stripe_account_id }
  );

  if (intent.status !== "succeeded") {
    return NextResponse.json(
      { error: `Payment not completed (status: ${intent.status})` },
      { status: 400 }
    );
  }

  if (intent.metadata?.job_id && Number(intent.metadata.job_id) !== jobId) {
    return NextResponse.json(
      { error: "Payment intent is for a different job" },
      { status: 400 }
    );
  }

  const amountCents = Number(intent.metadata?.amount_cents);
  const tipCents = Number(intent.metadata?.tip_cents ?? 0);
  // Trust the intent's actual charged amount as the source of truth for the
  // grand total; split it into amount/tip using the metadata. If metadata is
  // missing for some reason, attribute everything to amount.
  const total = intent.amount_received || intent.amount;
  const finalAmount =
    Number.isFinite(amountCents) && amountCents > 0
      ? amountCents
      : total - (Number.isFinite(tipCents) ? tipCents : 0);
  const finalTip =
    Number.isFinite(tipCents) && tipCents >= 0 ? tipCents : 0;

  const send_email = body.send_email ? 1 : 0;
  const send_sms = body.send_sms ? 1 : 0;
  const payment_date = new Date().toISOString().slice(0, 10);
  const notes = body.notes ? String(body.notes) : null;

  // A saved-card intent can be confirmed before its charging request commits.
  // Use its provider-stored request key so later saved-card retries still find
  // the durable row after Stripe's own idempotency cache has expired.
  const savedKey = intent.metadata?.source === "saved_card"
    ? intent.metadata.payment_idempotency_key : null;
  const paymentInput = {
    company_id: companyId, job_id: jobId, amount_cents: finalAmount,
    tip_cents: finalTip, method: "card" as const, payment_date, notes, send_email, send_sms,
    stripe_payment_intent_id: intentId, idempotency_key: savedKey || `stripe-confirm:${intentId}`,
    payment_method_id: savedKey && intent.metadata.payment_method_row_id ? Number(intent.metadata.payment_method_row_id) : null,
    subscription_id: savedKey && intent.metadata.subscription_id ? Number(intent.metadata.subscription_id) : null,
  };
  if (savedKey && intent.metadata.request_fingerprint !== paymentRequestFingerprint(paymentInput)) {
    throw new PaymentIdempotencyError("Payment intent was charged with different payment details", 409);
  }

  const completionNotification = await preparePaymentCompletionNotification(db, jobId, companyId);
  const { payment: created, created: isNew, completedChanged } = await db.transaction(async (tx) => {
    const result = await insertPaymentIdempotently(tx, paymentInput);
    const completedChanged = result.created ? await autoCompleteSteps(tx, jobId, companyId, undefined, completionNotification) : false;
    return { ...result, completedChanged };
  });

  if (!isNew) return NextResponse.json({ ...created, idempotent_replay: true, lifecycle_notification: null, warning: null });

  const lifecycle_notification = await dispatchPaymentCompletionNotification({
    db,
    companyId,
    jobId,
    changed: completedChanged,
  });

  let warning = lifecycle_notification?.error || null;

  if (send_email || send_sms) {
    try {
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
    } catch {
      warning = [warning, "Payment recorded, but the receipt could not be delivered."].filter(Boolean).join(" ");
    }
  }

  return NextResponse.json({ ...created, idempotent_replay: false, lifecycle_notification, warning }, { status: 201 });
}
