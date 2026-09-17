import type { Db } from './db';
import { PaymentIdempotencyError } from '@/lib/payment-idempotency';

export async function assertNoUnresolvedTerminalPayment(db: Db, companyId: number, jobId: number) {
  // Read the primary: an edge replica may not yet contain another device's claim.
  const pending = await db.transaction(tx => tx.prepare("SELECT attempt_id FROM terminal_attempts WHERE company_id=? AND job_id=? AND operation='payment' AND status NOT IN ('succeeded','canceled') LIMIT 1").get(companyId,jobId));
  if (pending) throw new PaymentIdempotencyError('Reconcile or cancel the existing Tap to Pay attempt before starting another payment.',409);
}
