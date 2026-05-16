import type { Db, JobRecurrence, JobRecurrenceUnit } from "./db";
import { SCHEDULE_HORIZON_DAYS } from "./subscription-schedule";

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Add (n, unit) to a UTC date. For "month"/"year" the day-of-month is clamped
// to the last day of the target month when the original day doesn't exist
// there (e.g. Jan 31 + 1 month → Feb 28/29). Time-of-day is preserved.
function addStep(base: Date, n: number, unit: JobRecurrenceUnit): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const h = base.getUTCHours();
  const mi = base.getUTCMinutes();
  if (unit === "week") {
    return new Date(base.getTime() + n * 7 * 24 * 60 * 60 * 1000);
  }
  if (unit === "year") {
    const ny = y + n;
    const nd = Math.min(d, daysInMonth(ny, m));
    return new Date(Date.UTC(ny, m, nd, h, mi, 0));
  }
  const total = m + n;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return new Date(Date.UTC(ny, nm, nd, h, mi, 0));
}

export function nextVisitDate(rule: JobRecurrence, base: Date): Date {
  return addStep(base, rule.interval_n, rule.interval_unit);
}

// Returns the hard cutoff (exclusive) for this recurrence based on its end
// condition, OR null for "never". The rolling horizon is applied on top by
// the caller — a recurrence that runs forever still only generates visits
// within the next year at any time.
export function endCutoffIso(rule: JobRecurrence): string | null {
  if (rule.end_mode === "years" && rule.end_years) {
    const start = new Date(rule.anchor_date);
    const cutoff = new Date(start);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() + rule.end_years);
    return cutoff.toISOString();
  }
  return null;
}

// Ensure this recurrence has all its future visits scheduled within the
// rolling one-year horizon. Idempotent: only inserts visits to fill the gap.
export async function ensureRecurrenceWindow(
  db: Db,
  ruleId: number,
  companyId: number
): Promise<void> {
  const rule = (await db
    .prepare(
      `SELECT * FROM job_recurrences WHERE id = ? AND company_id = ?`
    )
    .get(ruleId, companyId)) as JobRecurrence | undefined;
  if (!rule || rule.status !== "active") return;

  const now = new Date();
  const horizonIso = new Date(
    now.getTime() + SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const endIsoLimit = endCutoffIso(rule);

  const existing = (await db
    .prepare(
      `SELECT id, scheduled_at, recurrence_visit_index, status
         FROM jobs
        WHERE recurrence_id = ? AND company_id = ?
        ORDER BY recurrence_visit_index ASC`
    )
    .all(ruleId, companyId)) as {
    id: number;
    scheduled_at: string;
    recurrence_visit_index: number | null;
    status: string;
  }[];

  const maxIdx = existing.reduce(
    (m, r) => Math.max(m, r.recurrence_visit_index || 0),
    0
  );
  const latestIso = existing.reduce(
    (latest, r) => (r.scheduled_at > latest ? r.scheduled_at : latest),
    ""
  );

  let nextIdx = maxIdx + 1;
  let nextDate = latestIso
    ? nextVisitDate(rule, new Date(latestIso))
    : nextVisitDate(rule, new Date(rule.anchor_date));

  while (true) {
    const nextIso = nextDate.toISOString();
    if (nextIso > horizonIso) break;
    if (endIsoLimit && nextIso > endIsoLimit) break;

    const endDt = new Date(nextDate.getTime() + rule.duration_minutes * 60_000);
    const endIso = endDt.toISOString();

    await db
      .prepare(
        `INSERT INTO jobs
           (company_id, customer_id, scheduled_at, end_time, duration_minutes,
            price_cents, status, notes,
            salesperson_id, technician_id,
            anytime, schedule_later, recurring,
            recurrence_id, recurrence_visit_index)
         VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?,
                 ?, ?,
                 0, 0, 1,
                 ?, ?)`
      )
      .run(
        companyId,
        rule.customer_id,
        nextIso,
        endIso,
        rule.duration_minutes,
        rule.price_cents,
        rule.notes,
        rule.salesperson_id,
        rule.technician_id,
        rule.id,
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
        .run(newJobId.id, rule.title, rule.notes, rule.price_cents);
    }
    nextIdx += 1;
    nextDate = nextVisitDate(rule, new Date(nextIso));
  }
}

export type RecurrenceInput = {
  interval_n: number;
  interval_unit: JobRecurrenceUnit;
  end_mode: "never" | "years";
  end_years?: number | null;
};

export function validateRecurrence(input: RecurrenceInput): string | null {
  if (!input.interval_n || input.interval_n < 1) {
    return "Interval must be at least 1";
  }
  if (!["week", "month", "year"].includes(input.interval_unit)) {
    return "Invalid interval unit";
  }
  if (input.end_mode === "years" && (!input.end_years || input.end_years < 1)) {
    return "Number of years must be at least 1";
  }
  return null;
}
