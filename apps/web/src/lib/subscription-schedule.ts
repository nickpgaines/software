import type { Db, SubscriptionInterval } from "./db";

const ROLLING_WINDOW = 4;

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

// Ensure the subscription has at least ROLLING_WINDOW future scheduled visits
// on the schedule. Idempotent: if some already exist, only fills up the gap.
// Past/completed visits are left alone.
export async function ensureRollingVisits(
  db: Db,
  args: SeedVisitsArgs
): Promise<void> {
  const days = intervalDays(args.serviceInterval);
  const nowIso = new Date().toISOString();

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

  const futureScheduled = existing.filter(
    (r) => r.scheduled_at >= nowIso && r.status !== "cancelled"
  );
  const need = ROLLING_WINDOW - futureScheduled.length;
  if (need <= 0) return;

  const maxIdx = existing.reduce(
    (m, r) => Math.max(m, r.subscription_visit_index || 0),
    0
  );

  let nextIdx = maxIdx + 1;
  let baseIso: string;
  if (existing.length === 0) {
    baseIso = args.startDateIso;
  } else {
    const lastIso = existing.reduce(
      (latest, r) =>
        r.scheduled_at > latest ? r.scheduled_at : latest,
      args.startDateIso
    );
    baseIso = addDaysIso(lastIso, days);
  }

  for (let i = 0; i < need; i++) {
    const visitIso = i === 0 ? baseIso : addDaysIso(baseIso, days * i);
    const endIso = addDaysIso(visitIso, 0);
    const endDt = new Date(endIso);
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
        visitIso,
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
