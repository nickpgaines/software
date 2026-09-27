import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { Db } from "./db.ts";
import { PaymentIdempotencyError, paymentRequestFingerprint, type PaymentInsert } from "./payment-idempotency.ts";

export type SavedCardPaymentAttempt = {
  company_id: number;
  idempotency_key: string;
  attempt_id: string;
  request_fingerprint: string;
  stripe_account_id: string;
  stripe_payment_intent_id: string | null;
  payment_date: string;
};

// Every read and reservation uses a primary write transaction supplied by the
// caller. A row without an intent is an unresolved submission, never permission
// to submit a second charge, regardless of Stripe's idempotency cache lifetime.
export async function findSavedCardPaymentAttempt(tx: Db, input: PaymentInsert) {
  const attempt = await tx.prepare(`SELECT * FROM saved_card_payment_attempts
    WHERE company_id = ? AND idempotency_key = ?`
  ).get<SavedCardPaymentAttempt>(input.company_id, input.idempotency_key);
  if (attempt && attempt.request_fingerprint !== paymentRequestFingerprint(input)) {
    throw new PaymentIdempotencyError("This payment key was already used with different payment details", 409);
  }
  return attempt;
}

export async function reserveSavedCardPaymentAttempt(tx: Db, input: PaymentInsert, stripeAccountId: string) {
  const result = await tx.prepare(`INSERT INTO saved_card_payment_attempts
    (company_id, idempotency_key, attempt_id, request_fingerprint, stripe_account_id, payment_date)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (company_id, idempotency_key) DO NOTHING`
  ).run(input.company_id, input.idempotency_key, randomUUID(), paymentRequestFingerprint(input), stripeAccountId, input.payment_date);
  const attempt = await findSavedCardPaymentAttempt(tx, input);
  if (!attempt) throw new Error("Payment attempt could not be reloaded");
  return { attempt, created: result.changes === 1 };
}

export async function bindSavedCardPaymentIntent(tx: Db, attempt: SavedCardPaymentAttempt, intentId: string) {
  const result = await tx.prepare(`UPDATE saved_card_payment_attempts
    SET stripe_payment_intent_id = ?, updated_at = datetime('now')
    WHERE company_id = ? AND idempotency_key = ? AND attempt_id = ?
      AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = ?)`
  ).run(intentId, attempt.company_id, attempt.idempotency_key, attempt.attempt_id, intentId);
  if (result.changes !== 1) throw new PaymentIdempotencyError("This payment attempt is already bound to another intent", 409);
}

export function validateSavedCardPaymentIntent(intent: Stripe.PaymentIntent, attempt: SavedCardPaymentAttempt) {
  if (intent.metadata.saved_card_attempt_id !== attempt.attempt_id ||
    intent.metadata.request_fingerprint !== attempt.request_fingerprint ||
    intent.metadata.payment_idempotency_key !== attempt.idempotency_key ||
    intent.metadata.company_id !== String(attempt.company_id) || intent.metadata.source !== "saved_card") {
    throw new PaymentIdempotencyError("The provider intent does not match this saved-card payment attempt", 409);
  }
}

export async function reconcileSavedCardPaymentAttempt(stripe: Stripe, attempt: SavedCardPaymentAttempt) {
  let intent: Stripe.PaymentIntent;
  try {
    let intentId = attempt.stripe_payment_intent_id;
    if (!intentId) {
      const result = await stripe.paymentIntents.search({
        query: `metadata['saved_card_attempt_id']:'${attempt.attempt_id}'`, limit: 2,
      }, { stripeAccount: attempt.stripe_account_id });
      // Search is eventually consistent. Only a single positive match permits
      // recovery; empty, unavailable, or ambiguous results cannot permit create.
      if (result.has_more || result.data.length !== 1) throw new Error("Intent not uniquely confirmed");
      intentId = result.data[0].id;
    }
    intent = await stripe.paymentIntents.retrieve(intentId, undefined, { stripeAccount: attempt.stripe_account_id });
  } catch {
    throw new PaymentIdempotencyError("This payment attempt is still unconfirmed. Retry with the same payment key to check its status, or contact support before collecting another payment.", 409);
  }
  validateSavedCardPaymentIntent(intent, attempt);
  return intent;
}
