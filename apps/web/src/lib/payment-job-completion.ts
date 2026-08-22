import type { Db } from "./db.ts";

type JobForNotification = {
  id: number;
  customer_id: number;
  customer_name: string | null;
  scheduled_at: string;
  price_cents: number;
  techs: Array<{ name: string }>;
};

type SendResult = {
  ok: boolean;
  messageId: number;
  status: string;
  error: string | null;
};

type NotificationResult =
  | { attempted: boolean; ok: boolean; error: string | null; messageId?: number; status?: string }
  | null;

type DispatchInput = {
  db: Db;
  companyId: number;
  step: "completed";
  changed: boolean;
  clear: boolean;
  job: {
    id: number;
    customerId: number;
    customerName: string | null;
    scheduledAt: string;
    totalCents: number;
    technicianName: string | null;
  };
  send: (message: { customerId: number; body: string }) => Promise<SendResult>;
};

export async function autoCompleteSteps(
  db: Db,
  jobId: number,
  companyId: number,
  timestamp = new Date().toISOString()
): Promise<boolean> {
  const before = await db
    .prepare(
      "SELECT completed_at, status FROM jobs WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get<{ completed_at: string | null; status: string }>(jobId, companyId);
  if (!before) return false;

  await db
    .prepare(
      `UPDATE jobs
         SET en_route_at  = COALESCE(en_route_at,  ?),
             arrived_at   = COALESCE(arrived_at,   ?),
             started_at   = COALESCE(started_at,   ?),
             completed_at = COALESCE(completed_at, ?),
             status = CASE WHEN status = 'cancelled' THEN status ELSE 'completed' END
       WHERE id = ? AND company_id = ?`
    )
    .run(timestamp, timestamp, timestamp, timestamp, jobId, companyId);

  // Payment completion fills these timestamps for bookkeeping; it must not
  // imply that drive/start events actually happened or text the customer.
  for (const step of ["en_route", "arrived", "started"] as const) {
    await db
      .prepare(
        `INSERT INTO job_lifecycle_notifications
           (company_id, job_id, step, outcome)
         SELECT ?, id, ?, 'skipped' FROM jobs WHERE id = ? AND company_id = ?
         ON CONFLICT (job_id, step) DO NOTHING`
      )
      .run(companyId, step, jobId, companyId);
  }

  return before.completed_at === null && before.status !== "cancelled";
}

export async function dispatchPaymentCompletionNotification(
  input: { db: Db; companyId: number; jobId: number; changed: boolean },
  injected?: {
    getJob(db: Db, jobId: number, companyId: number): Promise<JobForNotification | null>;
    dispatch(value: DispatchInput): Promise<NotificationResult>;
    send(value: { companyId: number; customerId: number; body: string }): Promise<SendResult>;
  }
): Promise<NotificationResult> {
  if (!input.changed) return null;
  try {
    const deps = injected || (await defaultDependencies());
    const detail = await deps.getJob(input.db, input.jobId, input.companyId);
    if (!detail) return null;
    return await deps.dispatch({
      db: input.db,
      companyId: input.companyId,
      step: "completed",
      changed: true,
      clear: false,
      job: {
        id: detail.id,
        customerId: detail.customer_id,
        customerName: detail.customer_name,
        scheduledAt: detail.scheduled_at,
        totalCents: detail.price_cents,
        technicianName: detail.techs[0]?.name || null,
      },
      send: ({ customerId, body }) =>
        deps.send({ companyId: input.companyId, customerId, body }),
    });
  } catch {
    // The payment is already committed; notification diagnostics are handled
    // by the dispatcher and must never turn a valid payment into an error.
    return { attempted: true, ok: false, error: "The job-finish text could not be prepared." };
  }
}

async function defaultDependencies() {
  const [{ getJobDetail }, { dispatchJobLifecycleNotification }, { sendAndLogCompanySms }] =
    await Promise.all([
      import("./jobs.ts"),
      import("./job-lifecycle-dispatch.ts"),
      import("./sms.ts"),
    ]);
  return {
    getJob: getJobDetail as (
      db: Db,
      jobId: number,
      companyId: number
    ) => Promise<JobForNotification | null>,
    dispatch: dispatchJobLifecycleNotification,
    send: sendAndLogCompanySms,
  };
}
