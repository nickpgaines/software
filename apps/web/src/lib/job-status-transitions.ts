import type { Db } from "./db.ts";
import type { JobLifecycleStep } from "./job-lifecycle-notifications.ts";
import { prepareJobLifecycleNotification } from "./job-lifecycle-dispatch.ts";
import { enqueueJobLifecycleNotification } from "./job-lifecycle-outbox.ts";

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
  const notification = clear ? null : await prepareJobLifecycleNotification({ db, jobId: id, companyId, step });
  return db.transaction(async tx => {
    const col = timestampColumn(step);
    const result = clear
      ? await tx
          .prepare(
            `UPDATE jobs
              SET ${col} = NULL, status = 'scheduled'
            WHERE id = ? AND company_id = ? AND ${col} IS NOT NULL`
          )
          .run(id, companyId)
      : await tx
          .prepare(
            `UPDATE jobs
              SET ${col} = ?, status = ?
            WHERE id = ? AND company_id = ? AND ${col} IS NULL`
          )
          .run(new Date().toISOString(), step, id, companyId);
    const changed = result.changes > 0;
    if (changed && notification) await enqueueJobLifecycleNotification(tx, notification);
    return changed;
  });
}
