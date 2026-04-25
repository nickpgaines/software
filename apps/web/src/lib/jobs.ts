import type Database from "better-sqlite3";
import type { Job, LineItem, ChecklistItem, JobAssignment } from "./db";

export type LineItemInput = {
  id?: number;
  title: string;
  description?: string | null;
  quantity: number;
  price_cents: number;
  taxable?: boolean | number;
  upsell?: boolean | number;
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
  sales_ids?: number[];
  tech_ids?: number[];
  line_items?: LineItemInput[];
  checklist_items?: ChecklistInput[];
};

export type JobDetail = Job & {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  line_items: LineItem[];
  checklist_items: ChecklistItem[];
  sales: { id: number; name: string; role: string | null }[];
  techs: { id: number; name: string; role: string | null }[];
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

function syncAssignments(
  db: Database.Database,
  jobId: number,
  ids: number[],
  role: "sales" | "tech"
) {
  db.prepare("DELETE FROM job_assignments WHERE job_id = ? AND role = ?").run(
    jobId,
    role
  );
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO job_assignments (job_id, staff_id, role) VALUES (?, ?, ?)"
  );
  for (const id of ids) stmt.run(jobId, id, role);
}

function syncLineItems(
  db: Database.Database,
  jobId: number,
  items: LineItemInput[]
) {
  db.prepare("DELETE FROM line_items WHERE job_id = ?").run(jobId);
  const stmt = db.prepare(
    `INSERT INTO line_items
       (job_id, title, description, quantity, price_cents, taxable, upsell, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  items.forEach((li, i) =>
    stmt.run(
      jobId,
      li.title,
      li.description || null,
      li.quantity,
      li.price_cents,
      toBit(li.taxable),
      toBit(li.upsell),
      i
    )
  );
}

function syncChecklist(
  db: Database.Database,
  jobId: number,
  items: ChecklistInput[]
) {
  db.prepare("DELETE FROM checklist_items WHERE job_id = ?").run(jobId);
  const stmt = db.prepare(
    "INSERT INTO checklist_items (job_id, text, completed, position) VALUES (?, ?, ?, ?)"
  );
  items.forEach((c, i) => stmt.run(jobId, c.text, toBit(c.completed), i));
}

export function createJob(db: Database.Database, input: JobInput) {
  const tx = db.transaction(() => {
    const lineItems = input.line_items || [];
    const total = totalCents(lineItems);
    const dur = durationMinutes(input.start_time, input.end_time);
    const sales = input.sales_ids || [];
    const techs = input.tech_ids || [];

    const result = db
      .prepare(
        `INSERT INTO jobs
           (customer_id, scheduled_at, duration_minutes, price_cents, status, notes,
            salesperson_id, technician_id, end_time, anytime, schedule_later,
            lead_source, recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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

    syncAssignments(db, id, sales, "sales");
    syncAssignments(db, id, techs, "tech");
    syncLineItems(db, id, lineItems);
    syncChecklist(db, id, input.checklist_items || []);

    return id;
  });
  return tx();
}

export function updateJob(
  db: Database.Database,
  id: number,
  input: Partial<JobInput>
) {
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
      | Job
      | undefined;
    if (!existing) throw new Error("Not found");

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
      (db
        .prepare(
          "SELECT staff_id FROM job_assignments WHERE job_id = ? AND role = 'sales'"
        )
        .all(id) as { staff_id: number }[]).map((r) => r.staff_id);
    const techs =
      input.tech_ids ??
      (db
        .prepare(
          "SELECT staff_id FROM job_assignments WHERE job_id = ? AND role = 'tech'"
        )
        .all(id) as { staff_id: number }[]).map((r) => r.staff_id);

    db.prepare(
      `UPDATE jobs
         SET customer_id = ?, scheduled_at = ?, duration_minutes = ?, price_cents = ?,
             status = ?, notes = ?, salesperson_id = ?, technician_id = ?,
             end_time = ?, anytime = ?, schedule_later = ?, lead_source = ?,
             recurring = ?
       WHERE id = ?`
    ).run(
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
      input.lead_source !== undefined ? input.lead_source : existing.lead_source,
      input.recurring !== undefined ? toBit(input.recurring) : existing.recurring,
      id
    );

    if (input.sales_ids !== undefined) syncAssignments(db, id, sales, "sales");
    if (input.tech_ids !== undefined) syncAssignments(db, id, techs, "tech");
    if (input.line_items) syncLineItems(db, id, input.line_items);
    if (input.checklist_items) syncChecklist(db, id, input.checklist_items);
  });
  tx();
}

export function getJobDetail(
  db: Database.Database,
  id: number
): JobDetail | null {
  const job = db
    .prepare(
      `SELECT j.*,
              c.name AS customer_name,
              c.phone AS customer_phone,
              c.email AS customer_email,
              c.address AS customer_address
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       WHERE j.id = ?`
    )
    .get(id) as
    | (Job & {
        customer_name: string;
        customer_phone: string | null;
        customer_email: string | null;
        customer_address: string | null;
      })
    | undefined;
  if (!job) return null;

  const lineItems = db
    .prepare(
      "SELECT * FROM line_items WHERE job_id = ? ORDER BY position ASC, id ASC"
    )
    .all(id) as LineItem[];

  const checklist = db
    .prepare(
      "SELECT * FROM checklist_items WHERE job_id = ? ORDER BY position ASC, id ASC"
    )
    .all(id) as ChecklistItem[];

  const sales = db
    .prepare(
      `SELECT s.id, s.name, s.role
       FROM job_assignments ja
       JOIN staff s ON s.id = ja.staff_id
       WHERE ja.job_id = ? AND ja.role = 'sales'
       ORDER BY s.name COLLATE NOCASE`
    )
    .all(id) as { id: number; name: string; role: string | null }[];

  const techs = db
    .prepare(
      `SELECT s.id, s.name, s.role
       FROM job_assignments ja
       JOIN staff s ON s.id = ja.staff_id
       WHERE ja.job_id = ? AND ja.role = 'tech'
       ORDER BY s.name COLLATE NOCASE`
    )
    .all(id) as { id: number; name: string; role: string | null }[];

  return {
    ...job,
    line_items: lineItems,
    checklist_items: checklist,
    sales,
    techs,
  };
}

export function setStatusStep(
  db: Database.Database,
  id: number,
  step: "en_route" | "arrived" | "started" | "completed",
  clear = false
) {
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
  db.prepare(`UPDATE jobs SET ${col} = ?, status = ? WHERE id = ?`).run(
    ts,
    newStatus,
    id
  );
}
