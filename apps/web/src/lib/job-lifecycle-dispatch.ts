import { loadCustomizations } from "./customization-store.ts";
import type { Db } from "./db.ts";
import { buildJobLifecycleMessage, type JobLifecycleStep } from "./job-lifecycle-notifications.ts";
import { deliverJobLifecycleNotification, type LifecycleSender, type PreparedJobLifecycleNotification } from "./job-lifecycle-outbox.ts";
import { companyTimeZone } from "./time-zone.ts";

// Preparation is read-only and runs before the status/payment mutation. Freeze
// the rendered body so delayed delivery uses the original event's details.
export async function prepareJobLifecycleNotification(input: {
  db: Db; companyId: number; jobId: number; step: JobLifecycleStep;
}): Promise<PreparedJobLifecycleNotification> {
  const prepared: PreparedJobLifecycleNotification = {
    companyId: input.companyId, jobId: input.jobId, step: input.step,
    customerId: null, body: null, outcome: "skipped", error: null,
  };
  try {
    const job = await input.db.prepare(`
      SELECT j.customer_id, c.name AS customer_name, j.scheduled_at, j.price_cents,
             (SELECT s.name FROM job_assignments ja JOIN staff s ON s.id = ja.staff_id
               WHERE ja.job_id = j.id AND ja.role = 'tech' AND s.company_id = j.company_id
               ORDER BY s.name LIMIT 1) AS technician_name
        FROM jobs j JOIN customers c ON c.id = j.customer_id AND c.company_id = j.company_id
       WHERE j.id = ? AND j.company_id = ? LIMIT 1
    `).get<{ customer_id: number; customer_name: string | null; scheduled_at: string; price_cents: number; technician_name: string | null }>(input.jobId, input.companyId);
    if (!job) return prepared;
    prepared.customerId = job.customer_id;
    const consent = await input.db.prepare(`SELECT 1 FROM estimates
      WHERE company_id = ? AND customer_id = ? AND sms_transactional_consent = 1 LIMIT 1`
    ).get(input.companyId, job.customer_id);
    if (!consent) return { ...prepared, error: "Transactional SMS consent has not been recorded for this customer." };
    const [config, company] = await Promise.all([
      loadCustomizations(input.db, input.companyId),
      input.db.prepare("SELECT name, time_zone FROM company WHERE id = ? LIMIT 1")
        .get<{ name: string | null; time_zone: string }>(input.companyId),
    ]);
    const message = buildJobLifecycleMessage({
      step: input.step, messages: config.messages, customerName: job.customer_name,
      companyName: company?.name?.trim() || "Forge service provider", scheduledAt: job.scheduled_at,
      totalCents: job.price_cents, technicianName: job.technician_name,
      locale: "en-US", timeZone: companyTimeZone(company?.time_zone),
    });
    return message ? { ...prepared, body: message.body, outcome: "pending" } : prepared;
  } catch (error) {
    return { ...prepared, outcome: "failed", error: String((error as Error)?.message || error).slice(0, 1000) };
  }
}

export async function dispatchJobLifecycleNotification(input: {
  db: Db; companyId: number; jobId: number; step: JobLifecycleStep;
  changed: boolean; clear: boolean; send: LifecycleSender;
}) {
  if (input.clear || !input.changed) return null;
  try {
    return await deliverJobLifecycleNotification(input);
  } catch {
    return { attempted: false, ok: false, outcome: "pending" as const, error: "The customer text is queued for delivery." };
  }
}
