import type { Db } from "./db.ts";
import type { JobLifecycleStep } from "./job-lifecycle-notifications.ts";

function timestampColumn(step: JobLifecycleStep) {
  return step === "en_route"
    ? "en_route_at"
    : step === "arrived"
    ? "arrived_at"
    : step === "started"
    ? "started_at"
    : "completed_at";
}

export async function setStatusStep(
  db: Db,
  id: number,
  step: JobLifecycleStep,
  companyId: number,
  clear = false
): Promise<boolean> {
  const col = timestampColumn(step);
  const result = clear
    ? await db
        .prepare(
          `UPDATE jobs
              SET ${col} = NULL, status = 'scheduled'
            WHERE id = ? AND company_id = ? AND ${col} IS NOT NULL`
        )
        .run(id, companyId)
    : await db
        .prepare(
          `UPDATE jobs
              SET ${col} = ?, status = ?
            WHERE id = ? AND company_id = ? AND ${col} IS NULL`
        )
        .run(new Date().toISOString(), step, id, companyId);
  return result.changes > 0;
}

export async function claimJobLifecycleNotification(
  db: Db,
  companyId: number,
  jobId: number,
  step: JobLifecycleStep
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO job_lifecycle_notifications (company_id, job_id, step)
       SELECT ?, id, ? FROM jobs WHERE id = ? AND company_id = ?
       ON CONFLICT (job_id, step) DO NOTHING`
    )
    .run(companyId, step, jobId, companyId);
  return result.changes > 0;
}

export async function recordJobLifecycleNotificationOutcome(
  db: Db,
  input: {
    companyId: number;
    jobId: number;
    step: JobLifecycleStep;
    outcome: "skipped" | "sent" | "failed";
    messageId: number | null;
    error: string | null;
  }
) {
  await db
    .prepare(
      `UPDATE job_lifecycle_notifications
          SET outcome = ?, message_id = ?, error = ?, updated_at = datetime('now')
        WHERE company_id = ? AND job_id = ? AND step = ?`
    )
    .run(
      input.outcome,
      input.messageId,
      input.error,
      input.companyId,
      input.jobId,
      input.step
    );
}
