import type { MessagesConfig } from "./customizations.ts";

export type JobLifecycleStep =
  | "en_route"
  | "arrived"
  | "started"
  | "completed";

export type LifecycleOutcome =
  | "pending"
  | "sending"
  | "sent"
  | "skipped"
  | "failed"
  | "unknown";

export type JobLifecycleNotificationRecord = {
  id: number;
  step: JobLifecycleStep;
  outcome: LifecycleOutcome;
  attempt_count: number;
  message_id: number | null;
  error: string | null;
  locked_at: string | null;
  last_attempt_at: string | null;
  retry_requested_at: string | null;
  retry_requested_by: number | null;
  created_at: string;
  updated_at: string;
};

export type JobLifecycleNotificationResult = {
  attempted: boolean;
  ok: boolean;
  error: string | null;
  messageId?: number;
  status?: string;
};

const MESSAGE_KEY_BY_STEP = {
  en_route: "drive_start",
  arrived: "drive_end",
  started: "job_started",
  completed: "job_finish",
} as const satisfies Record<JobLifecycleStep, keyof MessagesConfig>;

export function messageKeyForStep(step: JobLifecycleStep) {
  return MESSAGE_KEY_BY_STEP[step];
}

export function shouldNotifyForTransition(input: {
  clear: boolean;
  changed: boolean;
}) {
  return !input.clear && input.changed;
}

function customerNameParts(name: string | null | undefined) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "there",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

export function buildJobLifecycleMessage(input: {
  step: JobLifecycleStep;
  messages: MessagesConfig;
  customerName: string | null;
  companyName: string;
  scheduledAt: string;
  totalCents: number;
  technicianName: string | null;
  locale: string;
  timeZone: string;
}): { body: string } | null {
  const block = input.messages[messageKeyForStep(input.step)];
  const template = block.template.trim();
  if (!block.enabled || !template) return null;

  const { firstName, lastName } = customerNameParts(input.customerName);
  const scheduledDate = new Date(input.scheduledAt);
  const jobStart = Number.isNaN(scheduledDate.getTime())
    ? input.scheduledAt
    : new Intl.DateTimeFormat(input.locale, {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: input.timeZone,
      }).format(scheduledDate);
  const jobTotal = new Intl.NumberFormat(input.locale, {
    style: "currency",
    currency: "USD",
  }).format(input.totalCents / 100);

  const variables: Record<string, string> = {
    customer_first_name: firstName,
    customer_last_name: lastName,
    company_name: input.companyName,
    job_start: jobStart,
    job_total: jobTotal,
  };
  let body = template;
  for (const [key, value] of Object.entries(variables)) {
    body = body.replaceAll(`{${key}}`, value);
  }

  if (block.include_personalized_header) {
    body = `Hi ${firstName},\n${body}`;
  }
  if (block.include_driver_name_image && input.technicianName?.trim()) {
    body = `${body}\nYour technician is ${input.technicianName.trim()}.`;
  }

  return { body };
}

export function notificationWarning(
  result: JobLifecycleNotificationResult | null
) {
  if (!result?.attempted || result.ok) return null;
  return `Job status updated, but the customer text was not delivered: ${
    result.error || "Unknown delivery error"
  }`;
}

export function paymentResponseWarning(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("warning" in payload)) {
    return null;
  }
  const warning = (payload as { warning?: unknown }).warning;
  return typeof warning === "string" && warning.trim() ? warning.trim() : null;
}

const NOTIFICATION_PRESENTATION: Record<LifecycleOutcome, {
  label: string;
  retryLabel: string | null;
  requiresConfirmation: boolean;
  duplicateRisk: string | null;
}> = {
  pending: { label: "Pending", retryLabel: null, requiresConfirmation: false, duplicateRisk: null },
  sending: { label: "Sending", retryLabel: null, requiresConfirmation: false, duplicateRisk: null },
  sent: { label: "Sent", retryLabel: null, requiresConfirmation: false, duplicateRisk: null },
  skipped: { label: "Skipped", retryLabel: null, requiresConfirmation: false, duplicateRisk: null },
  failed: { label: "Failed", retryLabel: "Retry text", requiresConfirmation: false, duplicateRisk: null },
  unknown: {
    label: "Delivery unknown",
    retryLabel: "Retry text anyway",
    requiresConfirmation: true,
    duplicateRisk: "Delivery may have succeeded. Retrying could send a duplicate text.",
  },
};

export function lifecycleNotificationPresentation(outcome: LifecycleOutcome) {
  return NOTIFICATION_PRESENTATION[outcome];
}
