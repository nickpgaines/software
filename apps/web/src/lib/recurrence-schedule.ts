import type {
  Db,
  JobRecurrence,
  JobRecurrenceFrequency,
  JobRecurrenceUnit,
} from "./db";
import { SCHEDULE_HORIZON_DAYS } from "./subscription-schedule";

// One step of the recurrence as a (n, unit) pair. Built-in frequencies expand
// to fixed month counts; "custom" reads the rule's own custom_interval fields.
function stepFor(rule: JobRecurrence): { n: number; unit: JobRecurrenceUnit } {
  switch (rule.frequency) {
    case "quarterly":
      return { n: 3, unit: "month" };
    case "biannually":
      return { n: 6, unit: "month" };
    case "annually":
      return { n: 1, unit: "year" };
    case "custom": {
      const n = rule.custom_interval_n ?? 1;
      const unit = rule.custom_interval_unit ?? "month";
      return { n: Math.max(1, n), unit };
    }
  }
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Add (n, unit) to a UTC date, clamping the day to the last day of the target
// month when the original day-of-month doesn't exist there. Time-of-day is
// preserved.
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
  // month
  const total = m + n;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return new Date(Date.UTC(ny, nm, nd, h, mi, 0));
}

// Returns the same calendar position (e.g. "the 3rd Saturday") in the target
// month. Falls back to the last occurrence of that weekday if the nth doesn't
// fit (e.g. there isn't a 5th Friday).
function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number, // 0=Sun..6=Sat
  ordinal: number, // 1..5
  hours: number,
  minutes: number
): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = first.getUTCDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (ordinal - 1) * 7;
  const dim = daysInMonth(year, monthIndex);
  if (day > dim) day -= 7;
  return new Date(Date.UTC(year, monthIndex, day, hours, minutes, 0));
}

// Compute the next visit date after `base`. For same_date mode this is just
// `addStep`. For nth_weekday mode, we add the step to land in the target
// month/year, then snap to the matching ordinal weekday.
export function nextVisitDate(rule: JobRecurrence, base: Date): Date {
  const step = stepFor(rule);
  const naive = addStep(base, step.n, step.unit);
  if (rule.anchor_mode === "same_date" || step.unit === "week") return naive;

  const anchor = new Date(rule.anchor_date);
  const weekday = anchor.getUTCDay();
  // Ordinal of the anchor weekday within its month (1..5).
  const ordinal = Math.ceil(anchor.getUTCDate() / 7);

  return nthWeekdayOfMonth(
    naive.getUTCFullYear(),
    naive.getUTCMonth(),
    weekday,
    ordinal,
    naive.getUTCHours(),
    naive.getUTCMinutes()
  );
}

// Returns the hard cutoff (exclusive) for this recurrence based on its end
// condition, OR null for "never". The rolling horizon is applied on top by
// the caller — a recurrence that runs forever still only generates visits
// within the next year at any time.
export function endCutoffIso(rule: JobRecurrence): string | null {
  if (rule.end_mode === "on_date" && rule.end_on_date) {
    const d = new Date(rule.end_on_date);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
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
// Stops when an end condition (after N, on date, X years) is reached.
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

  let maxIdx = existing.reduce(
    (m, r) => Math.max(m, r.recurrence_visit_index || 0),
    0
  );
  let latestIso = existing.reduce(
    (latest, r) => (r.scheduled_at > latest ? r.scheduled_at : latest),
    ""
  );

  // Compute the next date to insert. The first visit always lands exactly on
  // the anchor (which is the source job's own date), so we don't insert it
  // again — only the 2nd, 3rd, … visits are generated here.
  let nextIdx: number;
  let nextDate: Date;
  if (!latestIso) {
    nextIdx = maxIdx + 1;
    nextDate = nextVisitDate(rule, new Date(rule.anchor_date));
  } else {
    nextIdx = maxIdx + 1;
    nextDate = nextVisitDate(rule, new Date(latestIso));
  }

  const visitCap =
    rule.end_mode === "after_n_visits" && rule.end_after_visits
      ? rule.end_after_visits
      : Infinity;

  while (true) {
    const nextIso = nextDate.toISOString();
    if (nextIso > horizonIso) break;
    if (endIsoLimit && nextIso > endIsoLimit) break;
    if (nextIdx > visitCap) break;

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
    latestIso = nextIso;
    nextIdx += 1;
    nextDate = nextVisitDate(rule, new Date(nextIso));
  }

  if (nextIdx - 1 >= visitCap && rule.end_mode === "after_n_visits") {
    // All visits scheduled; nothing more to do. Status stays 'active' so the
    // cron simply no-ops on future runs.
  }
}

export type RecurrenceInput = {
  frequency: JobRecurrenceFrequency;
  custom_interval_n?: number | null;
  custom_interval_unit?: JobRecurrenceUnit | null;
  anchor_mode: "same_date" | "nth_weekday";
  end_mode: "never" | "after_n_visits" | "on_date" | "years";
  end_after_visits?: number | null;
  end_on_date?: string | null;
  end_years?: number | null;
};

// Validates a RecurrenceInput. Returns a string error message or null.
export function validateRecurrence(input: RecurrenceInput): string | null {
  if (
    input.frequency === "custom" &&
    (!input.custom_interval_n ||
      input.custom_interval_n < 1 ||
      !input.custom_interval_unit)
  ) {
    return "Custom recurrence needs an interval and unit";
  }
  if (
    input.end_mode === "after_n_visits" &&
    (!input.end_after_visits || input.end_after_visits < 1)
  ) {
    return "Number of visits must be at least 1";
  }
  if (input.end_mode === "on_date" && !input.end_on_date) {
    return "End date is required";
  }
  if (input.end_mode === "years" && (!input.end_years || input.end_years < 1)) {
    return "Number of years must be at least 1";
  }
  return null;
}
