import { createHash } from "node:crypto";
import type { Db, Payment, PaymentMethod } from "./db.ts";

export class PaymentIdempotencyError extends Error {
  readonly status: 400 | 409;
  constructor(message: string, status: 400 | 409) {
    super(message);
    this.status = status;
    this.name = "PaymentIdempotencyError";
  }
}

export function requireIdempotencyKey(req: Request): string {
  const key = req.headers.get("Idempotency-Key")?.trim();
  if (!key || !/^[\x20-\x7e]{8,200}$/.test(key)) {
    throw new PaymentIdempotencyError("Idempotency-Key must contain 8–200 printable ASCII characters", 400);
  }
  return key;
}

type PaymentRequest = {
  job_id: number;
  amount_cents: number;
  tip_cents: number;
  method: PaymentMethod;
  notes?: string | null;
  send_email?: boolean | number;
  send_sms?: boolean | number;
  payment_method_id?: number | null;
  subscription_id?: number | null;
};

export function paymentRequestFingerprint(input: PaymentRequest): string {
  return createHash("sha256").update(JSON.stringify({
    job_id: input.job_id,
    amount_cents: input.amount_cents,
    tip_cents: input.tip_cents,
    method: input.method,
    notes: input.notes || null,
    send_email: !!input.send_email,
    send_sms: !!input.send_sms,
    payment_method_id: input.payment_method_id ?? null,
    subscription_id: input.subscription_id ?? null,
  })).digest("hex");
}

export type PaymentInsert = PaymentRequest & {
  company_id: number;
  idempotency_key: string;
  payment_date: string;
  stripe_payment_intent_id?: string | null;
};

export async function findPaymentReplay(db: Db, input: PaymentInsert): Promise<Payment | undefined> {
  const existing = await db.prepare(
    "SELECT * FROM payments WHERE company_id = ? AND idempotency_key = ? LIMIT 1"
  ).get<Payment>(input.company_id, input.idempotency_key);
  if (existing && (existing.job_id !== input.job_id || existing.request_fingerprint !== paymentRequestFingerprint(input))) {
    throw new PaymentIdempotencyError("This payment key was already used with different payment details", 409);
  }
  return existing;
}

// Call inside a write transaction. The unique index arbitrates competing
// inserts; the tenant/key reload never depends on lastInsertRowid after a conflict.
export async function insertPaymentIdempotently(tx: Db, input: PaymentInsert): Promise<{ payment: Payment; created: boolean }> {
  if (input.stripe_payment_intent_id) {
    // Preserve historical rows without imposing uniqueness on unaudited intent
    // IDs. Also covers saved-card/confirm races while the write lock is held.
    const recorded = await tx.prepare(
      "SELECT * FROM payments WHERE company_id = ? AND stripe_payment_intent_id = ? ORDER BY id"
    ).all<Payment>(input.company_id, input.stripe_payment_intent_id);
    if (recorded.some(payment => payment.job_id !== input.job_id)) {
      throw new PaymentIdempotencyError("Payment intent is already recorded for a different job", 409);
    }
    if (recorded[0]) {
      const payment = recorded[0];
      const prior = { ...payment, job_id: input.job_id, payment_method_id: null, subscription_id: null };
      const current = { ...input, payment_method_id: null, subscription_id: null };
      if (paymentRequestFingerprint(prior) !== paymentRequestFingerprint(current)) {
        throw new PaymentIdempotencyError("Payment intent is already recorded with different payment details", 409);
      }
      // If the same caller key exists, enforce its complete fingerprint too.
      await findPaymentReplay(tx, input);
      return { payment, created: false };
    }
  }
  const fingerprint = paymentRequestFingerprint(input);
  const result = await tx.prepare(`
    INSERT INTO payments (company_id, job_id, amount_cents, tip_cents, method,
      payment_date, notes, send_email, send_sms, stripe_payment_intent_id,
      subscription_id, idempotency_key, request_fingerprint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  `).run(input.company_id, input.job_id, input.amount_cents, input.tip_cents, input.method,
    input.payment_date, input.notes || null, input.send_email ? 1 : 0, input.send_sms ? 1 : 0,
    input.stripe_payment_intent_id ?? null, input.subscription_id ?? null, input.idempotency_key, fingerprint);
  const payment = await findPaymentReplay(tx, input);
  if (!payment) throw new Error("Payment insert could not be reloaded");
  return { payment, created: result.changes === 1 };
}
