import { loadCustomizations } from "./customization-store.ts";
import type { Db } from "./db.ts";
import {
  buildJobLifecycleMessage,
  shouldNotifyForTransition,
  type JobLifecycleNotificationResult,
  type JobLifecycleStep,
} from "./job-lifecycle-notifications.ts";
import {
  claimJobLifecycleNotification,
  recordJobLifecycleNotificationOutcome,
} from "./job-status-transitions.ts";

type SendResult = {
  ok: boolean;
  messageId: number;
  status: string;
  error: string | null;
};

export async function dispatchJobLifecycleNotification(input: {
  db: Db;
  companyId: number;
  step: JobLifecycleStep;
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
}): Promise<JobLifecycleNotificationResult | null> {
  if (
    !shouldNotifyForTransition({ clear: input.clear, changed: input.changed })
  ) {
    return null;
  }

  let claimed = false;
  try {
    claimed = await claimJobLifecycleNotification(
      input.db,
      input.companyId,
      input.job.id,
      input.step
    );
    if (!claimed) return null;

    const [config, company] = await Promise.all([
      loadCustomizations(input.db, input.companyId),
      input.db
        .prepare("SELECT name FROM company WHERE id = ? LIMIT 1")
        .get<{ name: string | null }>(input.companyId),
    ]);
    const message = buildJobLifecycleMessage({
      step: input.step,
      messages: config.messages,
      customerName: input.job.customerName,
      companyName: company?.name?.trim() || "Forge service provider",
      scheduledAt: input.job.scheduledAt,
      totalCents: input.job.totalCents,
      technicianName: input.job.technicianName,
      locale: "en-US",
      timeZone: "America/New_York",
    });
    if (!message) {
      await recordJobLifecycleNotificationOutcome(input.db, {
        companyId: input.companyId,
        jobId: input.job.id,
        step: input.step,
        outcome: "skipped",
        messageId: null,
        error: null,
      });
      return null;
    }

    const sent = await input.send({
      customerId: input.job.customerId,
      body: message.body,
    });
    await recordJobLifecycleNotificationOutcome(input.db, {
      companyId: input.companyId,
      jobId: input.job.id,
      step: input.step,
      outcome: sent.ok ? "sent" : "failed",
      messageId: sent.messageId,
      error: sent.error,
    });
    return { attempted: true, ...sent };
  } catch (error) {
    if (claimed) {
      try {
        await recordJobLifecycleNotificationOutcome(input.db, {
          companyId: input.companyId,
          jobId: input.job.id,
          step: input.step,
          outcome: "failed",
          messageId: null,
          error: String((error as Error)?.message || error).slice(0, 1000),
        });
      } catch {
        // The job transition must remain successful even if diagnostics fail.
      }
    }
    return {
      attempted: true,
      ok: false,
      error: "The customer text could not be prepared or delivered.",
    };
  }
}
