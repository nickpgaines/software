import { NextResponse } from "next/server";
import { assertNoUnresolvedTerminalPayment } from '@/lib/terminal-job-guard';
import { getDb, type StripePaymentMethod } from "@/lib/db";
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
import { requireIdempotencyKey, insertPaymentIdempotently, findPaymentReplay, paymentRequestFingerprint, PaymentIdempotencyError } from "@/lib/payment-idempotency";
import { bindSavedCardPaymentIntent, findSavedCardPaymentAttempt, reconcileSavedCardPaymentAttempt, reserveSavedCardPaymentAttempt, validateSavedCardPaymentIntent } from "@/lib/saved-card-payment-attempts";

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
  context: { params: { id: string } }
) {
  try {
    return await chargeSavedCard(req, context, requireIdempotencyKey(req));
  } catch (error) {
    if (error instanceof PaymentIdempotencyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

async function chargeSavedCard(
  req: Request,
  { params }: { params: { id: string } },
  key: string
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

  const send_email = body.send_email ? 1 : 0;
  const send_sms = body.send_sms ? 1 : 0;
  const payment_date = new Date().toISOString().slice(0, 10);
  const notes = body.notes ? String(body.notes) : null;
  const subscriptionId =
    body.subscription_id != null && Number(body.subscription_id) > 0
      ? Number(body.subscription_id)
      : null;
  const paymentInput = {
    company_id: companyId, job_id: jobId, amount_cents: amount, tip_cents: tip,
    method: "card" as const, payment_date, notes, send_email, send_sms,
    payment_method_id: body.payment_method_id ? Number(body.payment_method_id) : null,
    subscription_id: subscriptionId, idempotency_key: `saved-card:${key}`,
  };
  // A durable replay must not reach Stripe again, even after Stripe expires
  // its provider-side idempotency cache or the saved card has been removed.
  // Write transactions read the primary; a top-level replica read can miss
  // the committed payment. Release the transaction before contacting Stripe.
  const preflight = await db.transaction(async tx => ({
    replay: await findPaymentReplay(tx, paymentInput),
    attempt: await findSavedCardPaymentAttempt(tx, paymentInput),
  }));
  if (preflight.replay) return NextResponse.json({ ...preflight.replay, idempotent_replay: true, lifecycle_notification: null, warning: null });
  let attempt = preflight.attempt;
  let mayCreate = false;

  // Pick the PM: explicit id wins, otherwise the customer's default.
  let pm: StripePaymentMethod | undefined;
  if (!attempt) {
    await assertNoUnresolvedTerminalPayment(db,companyId,jobId);
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
           WHERE company_id = ? AND customer_id = ? AND requires_explicit_selection = 0
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
    if (pm.recurring_only) return NextResponse.json({ error: 'This wallet-generated card can only be used for agreed recurring subscription payments.' }, { status: 409 });
    if (pm.stripe_account_id && pm.stripe_account_id !== company.stripe_account_id) return NextResponse.json({ error: 'Saved card belongs to a different Stripe account' }, { status: 409 });
    const reservation = await db.transaction(async tx => {
      const replay = await findPaymentReplay(tx, paymentInput);
      if (replay) return { replay, attempt: undefined, created: false };
      return { replay: undefined, ...await reserveSavedCardPaymentAttempt(tx, paymentInput, company.stripe_account_id!) };
    });
    if (reservation.replay) return NextResponse.json({ ...reservation.replay, idempotent_replay: true, lifecycle_notification: null, warning: null });
    attempt = reservation.attempt!;
    mayCreate = reservation.created;
  }
  paymentInput.payment_date = attempt.payment_date;

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((total * feeBps) / 10_000)
      : 0;

  const stripe = getStripe();
  let intent;
  if (!mayCreate) {
    intent = await reconcileSavedCardPaymentAttempt(stripe, attempt);
  } else {
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: total,
          currency: "usd",
          customer: pm!.stripe_customer_id,
          payment_method: pm!.stripe_payment_method_id,
          confirm: true,
          off_session: true,
          description: `Job #${jobId} — ${job.name ?? "Customer"} (saved card)`,
          metadata: {
            job_id: String(jobId),
            customer_id: String(job.customer_id),
            amount_cents: String(amount),
            tip_cents: String(tip),
            application_fee_cents: String(applicationFee),
            subscription_id: subscriptionId ? String(subscriptionId) : "",
            source: "saved_card",
            company_id: String(companyId),
            saved_card_attempt_id: attempt.attempt_id,
            payment_idempotency_key: paymentInput.idempotency_key,
            payment_method_row_id: paymentInput.payment_method_id ? String(paymentInput.payment_method_id) : "",
            request_fingerprint: paymentRequestFingerprint(paymentInput),
          },
          receipt_email: job.email || undefined,
          ...(applicationFee > 0
            ? { application_fee_amount: applicationFee }
            : {}),
        },
        { stripeAccount: attempt.stripe_account_id, idempotencyKey: `forge:${companyId}:saved:${key}` }
      );
    } catch (e) {
      // Stripe throws on declines, including 3DS required. Surface the
      // `requires_action` case as a 402 so the UI can fall back to an
      // on-session collection flow.
      const err = e as { type?: string; code?: string; message?: string; payment_intent?: { id?: string; status?: string } };
      if (err.type === "StripeIdempotencyError" || err.code === "idempotency_key_in_use") {
        throw new PaymentIdempotencyError("This payment key is already in use; retry the original payment details", 409);
      }
      const requiresAction =
        err.code === "authentication_required" ||
        err.payment_intent?.status === "requires_action";
      if (err.payment_intent?.id) {
        await db.transaction(tx => bindSavedCardPaymentIntent(tx, attempt!, err.payment_intent!.id!));
      }
      if (!err.payment_intent?.id && !requiresAction &&
        !["StripeCardError", "StripeInvalidRequestError", "StripeAuthenticationError", "StripePermissionError", "StripeRateLimitError"].includes(err.type || "")) {
        throw new PaymentIdempotencyError("This payment attempt is unconfirmed. Retry with the same payment key to check its status, or contact support before collecting another payment.", 409);
      }
      return NextResponse.json(
        {
          error: err.message || "Card was declined",
          requires_action: requiresAction,
          payment_intent_id: err.payment_intent?.id,
        },
        { status: requiresAction ? 402 : 400 }
      );
    }
  }
  validateSavedCardPaymentIntent(intent, attempt);
  // Bind acceptance in its own durable commit before preparing/recording the
  // payment. If this write fails, the reservation remains for reconciliation.
  await db.transaction(tx => bindSavedCardPaymentIntent(tx, attempt!, intent.id));

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

  const completionNotification = await preparePaymentCompletionNotification(db, jobId, companyId);
  const { payment: created, created: isNew, completedChanged } = await db.transaction(async (tx) => {
    const result = await insertPaymentIdempotently(tx, { ...paymentInput, stripe_payment_intent_id: intent.id });
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
