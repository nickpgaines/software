import type { Db } from "./db";

// Canonical event type strings. Adding a new event type is a one-line
// change here plus a hook point at the source of the action; the API
// route returns all rows without filtering by type, so new types show
// up in the feed automatically.
export type ActivityType =
  | "job.sold"
  | "job.started"
  | "job.completed"
  | "job.paid"
  | "payment.recorded"
  | "estimate.approved"
  | "invoice.paid"
  | "task.completed";

export type RecordActivityInput = {
  type: ActivityType;
  subjectType: string;
  subjectId?: number | null;
  subjectLabel?: string | null;
  actorUserId?: number | null;
  amountCents?: number | null;
  metadata?: Record<string, unknown> | null;
};

// Append an event to the activity feed. Best-effort: a failure here must
// never break the underlying action (a payment recording must succeed
// even if the activity insert errors), so callers wrap this in their
// own try/catch or call it after their primary write commits.
export async function recordActivity(
  db: Db,
  companyId: number,
  input: RecordActivityInput
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO activity_events
         (company_id, actor_user_id, type, subject_type, subject_id,
          subject_label, amount_cents, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      input.actorUserId ?? null,
      input.type,
      input.subjectType,
      input.subjectId ?? null,
      input.subjectLabel ?? null,
      input.amountCents ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null
    );
}
