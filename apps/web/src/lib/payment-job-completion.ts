import type { Db } from "./db.ts";
import { prepareJobLifecycleNotification } from "./job-lifecycle-dispatch.ts";
import { deliverJobLifecycleNotification, enqueueJobLifecycleNotification, type LifecycleSender, type PreparedJobLifecycleNotification } from "./job-lifecycle-outbox.ts";

export function preparePaymentCompletionNotification(db: Db, jobId: number, companyId: number) {
  return prepareJobLifecycleNotification({ db, jobId, companyId, step: "completed" });
}

export async function autoCompleteSteps(
  db: Db,
  jobId: number,
  companyId: number,
  timestamp = new Date().toISOString(),
  notification?: PreparedJobLifecycleNotification
): Promise<boolean> {
  const prepared = notification ?? await preparePaymentCompletionNotification(db, jobId, companyId);
  // Reuses the caller's payment transaction; direct callers are atomic too.
  return db.transaction(async tx => {
    const before = await tx.prepare(
      "SELECT completed_at, status FROM jobs WHERE id = ? AND company_id = ? LIMIT 1"
    ).get<{ completed_at: string | null; status: string }>(jobId, companyId);
    if (!before) return false;
    await tx.prepare(`UPDATE jobs
      SET en_route_at = COALESCE(en_route_at, ?), arrived_at = COALESCE(arrived_at, ?),
          started_at = COALESCE(started_at, ?), completed_at = COALESCE(completed_at, ?),
          status = CASE WHEN status = 'cancelled' THEN status ELSE 'completed' END
      WHERE id = ? AND company_id = ?`
    ).run(timestamp, timestamp, timestamp, timestamp, jobId, companyId);
    for (const step of ["en_route", "arrived", "started"] as const) {
      await enqueueJobLifecycleNotification(tx, {
        companyId, jobId, step, customerId: prepared.customerId,
        outcome: "skipped", body: null, error: null,
      });
    }
    const changed = before.completed_at === null && before.status !== "cancelled";
    if (changed) await enqueueJobLifecycleNotification(tx, prepared);
    return changed;
  });
}

export async function dispatchPaymentCompletionNotification(
  input: { db: Db; companyId: number; jobId: number; changed: boolean },
  injected?: { send: LifecycleSender }
) {
  if (!input.changed) return null;
  try {
    const send = injected?.send ?? (await import("./sms.ts")).sendAndLogCompanySms;
    return await deliverJobLifecycleNotification({ ...input, step: "completed", send });
  } catch {
    // A committed payment remains successful even if immediate draining cannot
    // reach the database. Its pending row remains available to the cron worker.
    return { attempted: false, ok: false, outcome: "pending" as const, error: "The job-finish text is queued for delivery." };
  }
}
