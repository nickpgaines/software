import { getDb } from '@/lib/db';
import { insertPaymentIdempotently, type PaymentInsert } from '@/lib/payment-idempotency';
import { autoCompleteSteps, preparePaymentCompletionNotification, dispatchPaymentCompletionNotification } from '@/lib/payment-job-completion';
import { sendPaymentReceipt } from '@/lib/payment-receipts';

/** Shared confirmation/Terminal effects; the transaction deduplicates payment and job completion. */
export async function recordJobPayment(input: PaymentInsert) {
  const db = await getDb();
  const completion = await preparePaymentCompletionNotification(db, input.job_id, input.company_id);
  const result = await db.transaction(async tx => {
    const result = await insertPaymentIdempotently(tx, input);
    const changed = result.created ? await autoCompleteSteps(tx, input.job_id, input.company_id, undefined, completion) : false;
    return { ...result, changed };
  });
  if (!result.created) return { ...result.payment, idempotent_replay: true, lifecycle_notification: null, warning: null };
  const lifecycle_notification = await dispatchPaymentCompletionNotification({ db, companyId: input.company_id, jobId: input.job_id, changed: result.changed });
  let warning = lifecycle_notification?.error || null;
  if (input.send_email || input.send_sms) {
    try {
      await sendPaymentReceipt({ jobId: input.job_id, paymentId: result.payment.id, companyId: input.company_id,
        amountCents: result.payment.amount_cents, tipCents: result.payment.tip_cents ?? 0, method: 'card',
        paymentDate: result.payment.payment_date || input.payment_date, sendEmail: !!input.send_email, sendSms: !!input.send_sms });
    } catch { warning = [warning, 'Payment recorded, but the receipt could not be delivered.'].filter(Boolean).join(' '); }
  }
  return { ...result.payment, idempotent_replay: false, lifecycle_notification, warning };
}
