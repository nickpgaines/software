import type { Db, SubscriptionInterval } from "./db";

// All recurring scheduling (subscriptions + recurring jobs) shows a rolling
// one-year window of future visits at any time. Top up daily via cron.
export const SCHEDULE_HORIZON_DAYS = 365;

function intervalDays(i: SubscriptionInterval): number {
  switch (i) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "quarterly":
      return 91;
    case "triannually":
      return 122;
    case "semiannually":
      return 182;
    case "yearly":
      return 365;
  }
}

function addDaysIso(dateInput: string, days: number): string {
  const d = new Date(dateInput);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function dateOnlyToIso(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 14, 0, 0)).toISOString();
}

export type SeedVisitsArgs = {
  subscriptionId: number;
  customerId: number;
  companyId: number;
  startDateIso: string;
  serviceInterval: SubscriptionInterval;
  pricePerVisitCents: number;
  visitName: string;
  visitDescription: string | null;
  soldById: number | null;
  technicianId: number | null;
};

// Ensure the subscription has future scheduled visits covering the rolling
// one-year horizon. Idempotent: only inserts visits to fill the gap. Past or
// completed visits are left alone. Same framework is used by `job_recurrences`
// (see lib/recurrence-schedule.ts) — change the horizon constant in one place.
export async function ensureRollingVisits(
  db: Db,
  args: SeedVisitsArgs
): Promise<void> {
  const days = intervalDays(args.serviceInterval);
  const now = new Date();
  const horizonIso = new Date(
    now.getTime() + SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const existing = (await db
    .prepare(
      `SELECT id, scheduled_at, subscription_visit_index, status
         FROM jobs
        WHERE subscription_id = ? AND company_id = ?
        ORDER BY subscription_visit_index ASC`
    )
    .all(args.subscriptionId, args.companyId)) as {
    id: number;
    scheduled_at: string;
    subscription_visit_index: number | null;
    status: string;
  }[];

  const maxIdx = existing.reduce(
    (m, r) => Math.max(m, r.subscription_visit_index || 0),
    0
  );
  const latestIso = existing.reduce(
    (latest, r) => (r.scheduled_at > latest ? r.scheduled_at : latest),
    ""
  );

  let nextIso: string;
  let nextIdx = maxIdx + 1;
  if (!latestIso) {
    nextIso = args.startDateIso;
    nextIdx = 1;
  } else {
    nextIso = addDaysIso(latestIso, days);
  }

  while (nextIso <= horizonIso) {
    const endDt = new Date(nextIso);
    endDt.setUTCMinutes(endDt.getUTCMinutes() + 120);
    const endIsoStr = endDt.toISOString();

    await db
      .prepare(
        `INSERT INTO jobs
           (company_id, customer_id, scheduled_at, end_time, duration_minutes,
            price_cents, status, notes,
            salesperson_id, technician_id,
            anytime, schedule_later, recurring,
            subscription_id, subscription_visit_index)
         VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?,
                 ?, ?,
                 0, 0, 1,
                 ?, ?)`
      )
      .run(
        args.companyId,
        args.customerId,
        nextIso,
        endIsoStr,
        120,
        args.pricePerVisitCents,
        args.visitDescription,
        args.soldById,
        args.technicianId,
        args.subscriptionId,
        nextIdx
      );
    const newJobId = await db
      .prepare("SELECT last_insert_rowid() AS id")
      .get<{ id: number }>();
    if (newJobId?.id) {
      await db
        .prepare(
          `INSERT INTO line_items
             (job_id, title, description, quantity, price_cents, taxable, upsell, position)
           VALUES (?, ?, ?, 1, ?, 0, 0, 0)`
        )
        .run(
          newJobId.id,
          args.visitName,
          args.visitDescription,
          args.pricePerVisitCents
        );
    }
    nextIdx += 1;
    nextIso = addDaysIso(nextIso, days);
  }
}

export function startDateToIso(dateInput: string | null): string {
  if (!dateInput) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateOnlyToIso(dateInput);
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export type CancelMode = "all_future" | "keep_next";

export async function cancelFutureSubscriptionJobs(
  db: Db,
  subscriptionId: number,
  companyId: number,
  mode: CancelMode
): Promise<number> {
  const nowIso = new Date().toISOString();
  const future = (await db
    .prepare(
      `SELECT id, scheduled_at, subscription_visit_index
         FROM jobs
        WHERE subscription_id = ? AND company_id = ?
          AND scheduled_at >= ?
          AND status NOT IN ('cancelled', 'completed')
        ORDER BY scheduled_at ASC`
    )
    .all(subscriptionId, companyId, nowIso)) as {
    id: number;
    scheduled_at: string;
    subscription_visit_index: number | null;
  }[];

  const toCancel = mode === "keep_next" ? future.slice(1) : future;
  let count = 0;
  for (const row of toCancel) {
    await db
      .prepare(
        `UPDATE jobs SET status = 'cancelled' WHERE id = ? AND company_id = ?`
      )
      .run(row.id, companyId);
    count += 1;
  }
  return count;
}
