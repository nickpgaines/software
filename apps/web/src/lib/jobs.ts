import type {
  Db,
  Job,
  LineItem,
  ChecklistItem,
  JobAssignment,
  Payment,
} from "./db";
import {
  ensureRecurrenceWindow,
  validateRecurrence,
  type RecurrenceInput,
} from "./recurrence-schedule";

export type LineItemInput = {
  id?: number;
  title: string;
  description?: string | null;
  quantity: number;
  price_cents: number;
  taxable?: boolean | number;
  upsell?: boolean | number;
  is_addon?: boolean | number;
};

export type ChecklistInput = {
  id?: number;
  text: string;
  completed?: boolean | number;
};

export type JobInput = {
  customer_id: number;
  start_time: string;
  end_time?: string | null;
  anytime?: boolean | number;
  schedule_later?: boolean | number;
  lead_source?: string | null;
  status?: string;
  notes?: string | null;
  recurring?: boolean | number;
  recurrence?: RecurrenceInput | null;
  sales_ids?: number[];
  tech_ids?: number[];
  line_items?: LineItemInput[];
  checklist_items?: ChecklistInput[];
};

export type PaidStatus = "unpaid" | "partial" | "paid";

export type JobStatus =
  | "scheduled"
  | "in_progress"
  | "completed_unpaid"
  | "completed_partial"
  | "completed_paid";

export function computeJobStatus(job: {
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  price_cents: number;
  paid_total_cents: number;
}): JobStatus {
  const completed = !!job.completed_at;
  const anyStep =
    !!job.en_route_at ||
    !!job.arrived_at ||
    !!job.started_at ||
    !!job.completed_at;

  if (completed) {
    if (job.paid_total_cents <= 0) return "completed_unpaid";
    if (job.paid_total_cents >= (job.price_cents || 0)) return "completed_paid";
    return "completed_partial";
  }
  return anyStep ? "in_progress" : "scheduled";
}

export async function autoCompleteSteps(
  db: Db,
  jobId: number,
  companyId: number
) {
  const now = new Date().toISOString();
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
    .run(now, now, now, now, jobId, companyId);
}

export type JobDetail = Job & {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  line_items: LineItem[];
  checklist_items: ChecklistItem[];
  sales: { id: number; name: string; role: string | null }[];
  techs: { id: number; name: string; role: string | null }[];
  payments: Payment[];
  paid_total_cents: number;
  tip_total_cents: number;
  paid_status: PaidStatus;
  job_status: JobStatus;
};

const toBit = (v: boolean | number | undefined) =>
  v === true || v === 1 ? 1 : 0;

function lineTotalCents(li: { quantity: number; price_cents: number }) {
  return Math.round(li.quantity * li.price_cents);
}

function totalCents(items: { quantity: number; price_cents: number }[]) {
  return items.reduce((a, li) => a + lineTotalCents(li), 0);
}

export function durationMinutes(start: string, end: string | null | undefined) {
  if (!end) return 60;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 60_000));
}

async function syncAssignments(
  db: Db,
  jobId: number,
  ids: number[],
  role: "sales" | "tech"
) {
  await db
    .prepare("DELETE FROM job_assignments WHERE job_id = ? AND role = ?")
    .run(jobId, role);
  for (const id of ids) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO job_assignments (job_id, staff_id, role) VALUES (?, ?, ?)"
      )
      .run(jobId, id, role);
  }
}

let _lineItemsHasAddon: boolean | null = null;
async function lineItemsHasAddon(db: Db): Promise<boolean> {
  if (_lineItemsHasAddon !== null) return _lineItemsHasAddon;
  const cols = await db
    .prepare("PRAGMA table_info(line_items)")
    .all<{ name: string }>();
  _lineItemsHasAddon = cols.some((c) => c.name === "is_addon");
  return _lineItemsHasAddon;
}

async function syncLineItems(db: Db, jobId: number, items: LineItemInput[]) {
  const hasAddon = await lineItemsHasAddon(db);
  await db.prepare("DELETE FROM line_items WHERE job_id = ?").run(jobId);
  for (let i = 0; i < items.length; i++) {
    const li = items[i];
    const isAddon = toBit(li.is_addon);
    // Upsell can only be set on add-on items (items added after initial
    // job creation). Original line items always store upsell=0.
    const upsell = isAddon ? toBit(li.upsell) : 0;
    if (hasAddon) {
      await db
        .prepare(
          `INSERT INTO line_items
             (job_id, title, description, quantity, price_cents, taxable, upsell, is_addon, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          jobId,
          li.title,
          li.description || null,
          li.quantity,
          li.price_cents,
          toBit(li.taxable),
          upsell,
          isAddon,
          i
        );
    } else {
      await db
        .prepare(
          `INSERT INTO line_items
             (job_id, title, description, quantity, price_cents, taxable, upsell, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          jobId,
          li.title,
          li.description || null,
          li.quantity,
          li.price_cents,
          toBit(li.taxable),
          upsell,
          i
        );
    }
  }
}

async function syncChecklist(db: Db, jobId: number, items: ChecklistInput[]) {
  await db.prepare("DELETE FROM checklist_items WHERE job_id = ?").run(jobId);
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    await db
      .prepare(
        "INSERT INTO checklist_items (job_id, text, completed, position) VALUES (?, ?, ?, ?)"
      )
      .run(jobId, c.text, toBit(c.completed), i);
  }
}

export async function createJob(
  db: Db,
  input: JobInput,
  companyId: number
): Promise<number> {
  const recurrence = input.recurring && input.recurrence ? input.recurrence : null;
  if (recurrence) {
    const err = validateRecurrence(recurrence);
    if (err) throw new Error(err);
  }

  const newJobId = await db.transaction(async (tx) => {
    const lineItems = input.line_items || [];
    const total = totalCents(lineItems);
    const dur = durationMinutes(input.start_time, input.end_time);
    const sales = input.sales_ids || [];
    const techs = input.tech_ids || [];

    // Verify the referenced customer belongs to the same company.
    const customer = await tx
      .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
      .get<{ id: number }>(input.customer_id, companyId);
    if (!customer) throw new Error("Customer not found");

    const result = await tx
      .prepare(
        `INSERT INTO jobs
           (company_id, customer_id, scheduled_at, duration_minutes, price_cents, status, notes,
            salesperson_id, technician_id, end_time, anytime, schedule_later,
            lead_source, recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        companyId,
        input.customer_id,
        input.start_time,
        dur,
        total,
        input.status || "scheduled",
        input.notes || null,
        sales[0] || null,
        techs[0] || null,
        input.end_time || null,
        toBit(input.anytime),
        toBit(input.schedule_later),
        input.lead_source || null,
        toBit(input.recurring)
      );
    const id = Number(result.lastInsertRowid);

    await syncAssignments(tx, id, sales, "sales");
    await syncAssignments(tx, id, techs, "tech");
    await syncLineItems(tx, id, lineItems);
    await syncChecklist(tx, id, input.checklist_items || []);

    if (recurrence) {
      const title = lineItems[0]?.title?.trim() || "Recurring service";
      const ruleResult = await tx
        .prepare(
          `INSERT INTO job_recurrences
             (company_id, source_job_id, customer_id, frequency,
              custom_interval_n, custom_interval_unit,
              anchor_mode, anchor_date,
              time_of_day, duration_minutes, price_cents,
              technician_id, salesperson_id,
              title, notes,
              end_mode, end_after_visits, end_on_date, end_years,
              status, next_visit_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 2)`
        )
        .run(
          companyId,
          id,
          input.customer_id,
          recurrence.frequency,
          recurrence.frequency === "custom"
            ? recurrence.custom_interval_n ?? null
            : null,
          recurrence.frequency === "custom"
            ? recurrence.custom_interval_unit ?? null
            : null,
          recurrence.anchor_mode,
          input.start_time,
          null,
          dur,
          total,
          techs[0] || null,
          sales[0] || null,
          title,
          input.notes || null,
          recurrence.end_mode,
          recurrence.end_mode === "after_n_visits"
            ? recurrence.end_after_visits ?? null
            : null,
          recurrence.end_mode === "on_date"
            ? recurrence.end_on_date ?? null
            : null,
          recurrence.end_mode === "years"
            ? recurrence.end_years ?? null
            : null
        );
      const ruleId = Number(ruleResult.lastInsertRowid);

      // The source job IS visit #1 of the series. Link it so the schedule
      // view can group/highlight it with its siblings.
      await tx
        .prepare(
          `UPDATE jobs
             SET recurrence_id = ?, recurrence_visit_index = 1
           WHERE id = ? AND company_id = ?`
        )
        .run(ruleId, id, companyId);

      return { jobId: id, ruleId };
    }

    return { jobId: id, ruleId: null as number | null };
  });

  if (newJobId.ruleId) {
    // Seed the rolling year-long window outside the transaction so the
    // generator can re-query its own inserts cleanly.
    await ensureRecurrenceWindow(db, newJobId.ruleId, companyId);
  }

  return newJobId.jobId;
}

export async function updateJob(
  db: Db,
  id: number,
  input: Partial<JobInput>,
  companyId: number
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .prepare("SELECT * FROM jobs WHERE id = ? AND company_id = ?")
      .get<Job>(id, companyId);
    if (!existing) throw new Error("Not found");
    if (
      input.customer_id !== undefined &&
      input.customer_id !== existing.customer_id
    ) {
      const cust = await tx
        .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
        .get<{ id: number }>(input.customer_id, companyId);
      if (!cust) throw new Error("Customer not found");
    }

    const start = input.start_time ?? existing.scheduled_at;
    const end = input.end_time === undefined ? existing.end_time : input.end_time;
    const dur = end
      ? durationMinutes(start, end)
      : input.start_time
      ? existing.duration_minutes
      : existing.duration_minutes;

    let priceCents = existing.price_cents;
    if (input.line_items) {
      priceCents = totalCents(input.line_items);
    }

    const sales =
      input.sales_ids ??
      (
        await tx
          .prepare(
            "SELECT staff_id FROM job_assignments WHERE job_id = ? AND role = 'sales'"
          )
          .all<{ staff_id: number }>(id)
      ).map((r) => r.staff_id);
    const techs =
      input.tech_ids ??
      (
        await tx
          .prepare(
            "SELECT staff_id FROM job_assignments WHERE job_id = ? AND role = 'tech'"
          )
          .all<{ staff_id: number }>(id)
      ).map((r) => r.staff_id);

    await tx
      .prepare(
        `UPDATE jobs
           SET customer_id = ?, scheduled_at = ?, duration_minutes = ?, price_cents = ?,
               status = ?, notes = ?, salesperson_id = ?, technician_id = ?,
               end_time = ?, anytime = ?, schedule_later = ?, lead_source = ?,
               recurring = ?
         WHERE id = ? AND company_id = ?`
      )
      .run(
        input.customer_id ?? existing.customer_id,
        start,
        dur,
        priceCents,
        input.status ?? existing.status,
        input.notes !== undefined ? input.notes : existing.notes,
        sales[0] || null,
        techs[0] || null,
        end,
        input.anytime !== undefined ? toBit(input.anytime) : existing.anytime,
        input.schedule_later !== undefined
          ? toBit(input.schedule_later)
          : existing.schedule_later,
        input.lead_source !== undefined
          ? input.lead_source
          : existing.lead_source,
        input.recurring !== undefined
          ? toBit(input.recurring)
          : existing.recurring,
        id,
        companyId
      );

    if (input.sales_ids !== undefined)
      await syncAssignments(tx, id, sales, "sales");
    if (input.tech_ids !== undefined)
      await syncAssignments(tx, id, techs, "tech");
    if (input.line_items) await syncLineItems(tx, id, input.line_items);
    if (input.checklist_items)
      await syncChecklist(tx, id, input.checklist_items);
  });
}

export async function getJobDetail(
  db: Db,
  id: number,
  companyId: number
): Promise<JobDetail | null> {
  const job = await db
    .prepare(
      `SELECT j.*,
              c.name AS customer_name,
              c.phone AS customer_phone,
              c.email AS customer_email,
              c.address AS customer_address
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       WHERE j.id = ? AND j.company_id = ?`
    )
    .get<
      Job & {
        customer_name: string;
        customer_phone: string | null;
        customer_email: string | null;
        customer_address: string | null;
      }
    >(id, companyId);
  if (!job) return null;

  const lineItems = await db
    .prepare(
      "SELECT * FROM line_items WHERE job_id = ? ORDER BY position ASC, id ASC"
    )
    .all<LineItem>(id);

  const checklist = await db
    .prepare(
      "SELECT * FROM checklist_items WHERE job_id = ? ORDER BY position ASC, id ASC"
    )
    .all<ChecklistItem>(id);

  const sales = await db
    .prepare(
      `SELECT s.id, s.name, s.role
       FROM job_assignments ja
       JOIN staff s ON s.id = ja.staff_id
       WHERE ja.job_id = ? AND ja.role = 'sales'
       ORDER BY s.name COLLATE NOCASE`
    )
    .all<{ id: number; name: string; role: string | null }>(id);

  const techs = await db
    .prepare(
      `SELECT s.id, s.name, s.role
       FROM job_assignments ja
       JOIN staff s ON s.id = ja.staff_id
       WHERE ja.job_id = ? AND ja.role = 'tech'
       ORDER BY s.name COLLATE NOCASE`
    )
    .all<{ id: number; name: string; role: string | null }>(id);

  const payments = await db
    .prepare(
      "SELECT * FROM payments WHERE job_id = ? ORDER BY created_at DESC, id DESC"
    )
    .all<Payment>(id);

  const paid_total_cents = payments.reduce(
    (sum, p) => sum + (p.amount_cents || 0),
    0
  );
  const tip_total_cents = payments.reduce(
    (sum, p) => sum + (p.tip_cents || 0),
    0
  );
  const total = job.price_cents || 0;
  const paid_status: PaidStatus =
    paid_total_cents <= 0
      ? "unpaid"
      : paid_total_cents >= total
      ? "paid"
      : "partial";

  const job_status = computeJobStatus({
    en_route_at: job.en_route_at,
    arrived_at: job.arrived_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    price_cents: job.price_cents,
    paid_total_cents,
  });

  return {
    ...job,
    line_items: lineItems,
    checklist_items: checklist,
    sales,
    techs,
    payments,
    paid_total_cents,
    tip_total_cents,
    paid_status,
    job_status,
  };
}

export async function setStatusStep(
  db: Db,
  id: number,
  step: "en_route" | "arrived" | "started" | "completed",
  companyId: number,
  clear = false
): Promise<void> {
  const col =
    step === "en_route"
      ? "en_route_at"
      : step === "arrived"
      ? "arrived_at"
      : step === "started"
      ? "started_at"
      : "completed_at";
  const newStatus = clear ? "scheduled" : step;
  const ts = clear ? null : new Date().toISOString();
  await db
    .prepare(
      `UPDATE jobs SET ${col} = ?, status = ? WHERE id = ? AND company_id = ?`
    )
    .run(ts, newStatus, id, companyId);
}

// JobAssignment is re-exported for callers
export type { JobAssignment };
