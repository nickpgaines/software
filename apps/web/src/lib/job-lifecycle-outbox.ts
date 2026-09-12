import type { Db } from "./db.ts";
import type {
  JobLifecycleNotificationRecord,
  JobLifecycleNotificationResult,
  JobLifecycleStep,
  LifecycleOutcome,
} from "./job-lifecycle-notifications.ts";

export type { LifecycleOutcome } from "./job-lifecycle-notifications.ts";
export type LifecycleSender = (input: { companyId: number; customerId: number; body: string }) => Promise<{
  ok: boolean; messageId: number; status: string; error: string | null;
}>;
export type PreparedJobLifecycleNotification = {
  companyId: number; jobId: number; step: JobLifecycleStep;
  customerId: number | null; body: string | null; outcome: "pending" | "skipped" | "failed"; error: string | null;
};
type NotificationRow = {
  company_id: number; job_id: number; step: JobLifecycleStep; customer_id: number | null;
  body: string | null; outcome: LifecycleOutcome; message_id: number | null; error: string | null; attempt_count: number;
};
export type LifecycleNotificationSummary = JobLifecycleNotificationResult & { outcome: LifecycleOutcome };

// Caller must use the same transaction as the job/payment mutation. The unique
// event key prevents clearing and reapplying a timestamp from creating a resend.
export async function enqueueJobLifecycleNotification(db: Db, input: PreparedJobLifecycleNotification) {
  const result = await db.prepare(`INSERT INTO job_lifecycle_notifications
    (company_id, job_id, step, customer_id, body, outcome, error)
    SELECT ?, id, ?, ?, ?, ?, ? FROM jobs WHERE id = ? AND company_id = ?
    ON CONFLICT (job_id, step) DO NOTHING`
  ).run(input.companyId, input.step, input.customerId, input.body, input.outcome, input.error, input.jobId, input.companyId);
  return result.changes > 0;
}

function summary(row: NotificationRow): LifecycleNotificationSummary {
  return {
    outcome: row.outcome, attempted: row.attempt_count > 0 || row.outcome === "failed",
    ok: row.outcome === "sent", error: row.error,
    ...(row.message_id == null ? {} : { messageId: row.message_id }), status: row.outcome,
  };
}

type DeliveryInput = {
  db: Db; companyId: number; jobId: number; step: JobLifecycleStep; send: LifecycleSender;
};

export function deliverJobLifecycleNotification(input: DeliveryInput) {
  return deliverNotification(input, false);
}

async function deliverNotification(input: DeliveryInput, pendingOnly: boolean): Promise<LifecycleNotificationSummary | null> {
  // Claim and read on the primary in one transaction, never a stale replica.
  const claimed = await input.db.transaction(async tx => {
    const result = await tx.prepare(`UPDATE job_lifecycle_notifications
      SET outcome = 'sending', attempt_count = attempt_count + 1,
          locked_at = datetime('now'), last_attempt_at = datetime('now'), updated_at = datetime('now')
      WHERE company_id = ? AND job_id = ? AND step = ? AND outcome = 'pending'`
    ).run(input.companyId, input.jobId, input.step);
    const row = await tx.prepare(`SELECT * FROM job_lifecycle_notifications
      WHERE company_id = ? AND job_id = ? AND step = ?`
    ).get<NotificationRow>(input.companyId, input.jobId, input.step);
    return { acquired: result.changes === 1, row };
  });
  if (!claimed.row) return null;
  if (!claimed.acquired) return pendingOnly ? null : summary(claimed.row);

  let outcome: "sent" | "failed" | "unknown" = "failed";
  let messageId: number | null = null;
  let error: string | null = null;
  if (claimed.row.customer_id == null || !claimed.row.body) {
    error = "The customer text has no prepared recipient or body.";
  } else {
    try {
      const sent = await input.send({ companyId: input.companyId, customerId: claimed.row.customer_id, body: claimed.row.body });
      outcome = sent.ok ? "sent" : sent.status === "unknown" ? "unknown" : "failed";
      messageId = sent.messageId;
      error = sent.error;
    } catch (cause) {
      // A thrown timeout can occur after the provider accepted the text.
      outcome = "unknown";
      error = String((cause as Error)?.message || cause).slice(0, 1000);
    }
  }
  try {
    return await input.db.transaction(async tx => {
      await tx.prepare(`UPDATE job_lifecycle_notifications
        SET outcome = ?, message_id = ?, error = ?, locked_at = NULL, updated_at = datetime('now')
        WHERE company_id = ? AND job_id = ? AND step = ? AND outcome = 'sending'`
      ).run(outcome, messageId, error, input.companyId, input.jobId, input.step);
      const row = await tx.prepare(`SELECT * FROM job_lifecycle_notifications
        WHERE company_id = ? AND job_id = ? AND step = ?`
      ).get<NotificationRow>(input.companyId, input.jobId, input.step);
      return row ? summary(row) : null;
    });
  } catch {
    // Preserve sending for stale-lock recovery. Never re-enter provider code.
    return { attempted: true, ok: false, outcome: "unknown", status: "unknown", error: "The customer text delivery could not be confirmed." };
  }
}

export async function runPendingJobLifecycleNotifications(input: { db: Db; send: LifecycleSender; limit?: number }) {
  const counts = { sent: 0, failed: 0, unknown: 0 };
  const rows = await input.db.transaction(async tx => {
    const stale = await tx.prepare(`UPDATE job_lifecycle_notifications
      SET outcome = 'unknown', error = 'Delivery was interrupted; provider acceptance is unknown.', updated_at = datetime('now')
      WHERE outcome = 'sending' AND (locked_at IS NULL OR datetime(locked_at) <= datetime('now', '-10 minutes'))`).run();
    counts.unknown = stale.changes;
    return tx.prepare(`SELECT company_id, job_id, step FROM job_lifecycle_notifications
      WHERE outcome = 'pending' ORDER BY created_at, id LIMIT ?`)
      .all<Pick<NotificationRow, "company_id" | "job_id" | "step">>(Math.min(500, Math.max(1, Math.floor(input.limit || 100))));
  });
  for (const row of rows) {
    const result = await deliverNotification({ ...input, companyId: row.company_id, jobId: row.job_id, step: row.step }, true);
    if (result && (result.outcome === "sent" || result.outcome === "failed" || result.outcome === "unknown")) counts[result.outcome]++;
  }
  return counts;
}

export async function listJobLifecycleNotifications(input: {
  db: Db;
  companyId: number;
  jobId: number;
}): Promise<JobLifecycleNotificationRecord[] | null> {
  const job = await input.db.prepare(
    "SELECT id FROM jobs WHERE id = ? AND company_id = ? LIMIT 1"
  ).get<{ id: number }>(input.jobId, input.companyId);
  if (!job) return null;
  return input.db.prepare(`SELECT
      id, step, outcome, attempt_count, message_id, error, locked_at,
      last_attempt_at, retry_requested_at, retry_requested_by, created_at, updated_at
    FROM job_lifecycle_notifications
    WHERE company_id = ? AND job_id = ?
    ORDER BY created_at, id`
  ).all<JobLifecycleNotificationRecord>(input.companyId, input.jobId);
}

export type LifecycleRetryRequestResult =
  | { ok: true; step: JobLifecycleStep }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "confirmation_required"; outcome: "unknown" }
  | { ok: false; reason: "not_retryable"; outcome: LifecycleOutcome };

export async function requestJobLifecycleNotificationRetry(input: {
  db: Db;
  companyId: number;
  jobId: number;
  notificationId: number;
  actorStaffId: number | null;
  confirmUnknown: boolean;
}): Promise<LifecycleRetryRequestResult> {
  return input.db.transaction(async tx => {
    const row = await tx.prepare(`SELECT step, outcome
      FROM job_lifecycle_notifications
      WHERE id = ? AND company_id = ? AND job_id = ? LIMIT 1`
    ).get<{ step: JobLifecycleStep; outcome: LifecycleOutcome }>(
      input.notificationId, input.companyId, input.jobId
    );
    if (!row) return { ok: false, reason: "not_found" };
    if (row.outcome === "unknown" && !input.confirmUnknown) {
      return { ok: false, reason: "confirmation_required", outcome: "unknown" };
    }
    if (row.outcome !== "failed" && row.outcome !== "unknown") {
      return { ok: false, reason: "not_retryable", outcome: row.outcome };
    }
    const updated = await tx.prepare(`UPDATE job_lifecycle_notifications
      SET outcome = 'pending', message_id = NULL, error = NULL, locked_at = NULL,
          retry_requested_at = datetime('now'), retry_requested_by = ?, updated_at = datetime('now')
      WHERE id = ? AND company_id = ? AND job_id = ? AND outcome = ?`
    ).run(input.actorStaffId, input.notificationId, input.companyId, input.jobId, row.outcome);
    if (updated.changes !== 1) {
      const current = await tx.prepare(`SELECT outcome FROM job_lifecycle_notifications
        WHERE id = ? AND company_id = ? AND job_id = ? LIMIT 1`
      ).get<{ outcome: LifecycleOutcome }>(input.notificationId, input.companyId, input.jobId);
      return current
        ? { ok: false, reason: "not_retryable", outcome: current.outcome }
        : { ok: false, reason: "not_found" };
    }
    return { ok: true, step: row.step };
  });
}
