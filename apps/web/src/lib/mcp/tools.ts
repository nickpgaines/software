import { getDb } from "@/lib/db";
import { sendCompanySms, normalizeUSPhone } from "@/lib/sms";
import { resolveEmailSender, sendEmailViaResend } from "@/lib/email";
import type { McpScope } from "./auth";

export type McpToolContext = {
  companyId: number;
  staffId: number | null;
  scopes: McpScope[];
};

export type McpJsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: McpJsonSchema;
  requiredScope: McpScope;
  handler: (
    args: Record<string, unknown>,
    ctx: McpToolContext
  ) => Promise<unknown>;
};

function num(v: unknown, fallback: number, max?: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (max != null && n > max) return max;
  if (n < 0) return 0;
  return Math.floor(n);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ---- tool implementations ---------------------------------------------------

const listJobs: McpTool = {
  name: "list_jobs",
  description:
    "List jobs in the CRM. Filter by date range (inclusive on `from`, exclusive on `to`, both ISO 8601) and/or status. Returns up to `limit` rows (default 50, max 200). Use this to find which jobs are scheduled on a particular day, e.g. before rescheduling.",
  requiredScope: "crm.read",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "ISO date or datetime (inclusive)" },
      to: { type: "string", description: "ISO date or datetime (exclusive)" },
      status: {
        type: "string",
        description: "scheduled | in_progress | completed | cancelled",
      },
      customer_id: { type: "number" },
      limit: { type: "number", description: "max 200, default 50" },
    },
  },
  async handler(args, ctx) {
    const db = await getDb();
    const where: string[] = ["j.company_id = ?"];
    const params: unknown[] = [ctx.companyId];
    if (str(args.from)) {
      where.push("j.scheduled_at >= ?");
      params.push(args.from);
    }
    if (str(args.to)) {
      where.push("j.scheduled_at < ?");
      params.push(args.to);
    }
    if (str(args.status)) {
      where.push("j.status = ?");
      params.push(args.status);
    }
    if (typeof args.customer_id === "number") {
      where.push("j.customer_id = ?");
      params.push(args.customer_id);
    }
    const limit = num(args.limit, 50, 200);
    const sql = `
      SELECT j.id, j.scheduled_at, j.end_time, j.status, j.price_cents,
             j.notes, j.customer_id,
             c.name AS customer_name, c.phone AS customer_phone,
             c.email AS customer_email,
             tc.name AS technician_name
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN staff tc ON tc.id = j.technician_id
       WHERE ${where.join(" AND ")}
       ORDER BY j.scheduled_at ASC
       LIMIT ${limit}
    `;
    const rows = await db.prepare(sql).all(...(params as never[]));
    return { jobs: rows, count: rows.length };
  },
};

const getJob: McpTool = {
  name: "get_job",
  description:
    "Get full detail on a single job by id including line items, assigned staff, and payments.",
  requiredScope: "crm.read",
  inputSchema: {
    type: "object",
    properties: { id: { type: "number" } },
    required: ["id"],
  },
  async handler(args, ctx) {
    const id = num(args.id, 0);
    if (!id) throw new Error("id is required");
    const db = await getDb();
    const job = await db
      .prepare(
        `SELECT j.*, c.name AS customer_name, c.phone AS customer_phone,
                c.email AS customer_email
           FROM jobs j JOIN customers c ON c.id = j.customer_id
          WHERE j.id = ? AND j.company_id = ? LIMIT 1`
      )
      .get(id, ctx.companyId);
    if (!job) throw new Error("Job not found");
    const lineItems = await db
      .prepare(
        "SELECT * FROM line_items WHERE job_id = ? ORDER BY position ASC"
      )
      .all(id);
    const payments = await db
      .prepare(
        "SELECT id, amount_cents, tip_cents, method, payment_date, notes FROM payments WHERE job_id = ?"
      )
      .all(id);
    return { job, line_items: lineItems, payments };
  },
};

const listCustomers: McpTool = {
  name: "list_customers",
  description:
    "Search and list customers. Optional `query` matches name, email, phone, or address.",
  requiredScope: "crm.read",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number", description: "max 200, default 50" },
    },
  },
  async handler(args, ctx) {
    const db = await getDb();
    const limit = num(args.limit, 50, 200);
    const q = str(args.query);
    if (!q) {
      const rows = await db
        .prepare(
          `SELECT id, name, first_name, last_name, phone, email,
                  formatted_address, is_recurring, created_at
             FROM customers WHERE company_id = ?
             ORDER BY created_at DESC LIMIT ${limit}`
        )
        .all(ctx.companyId);
      return { customers: rows, count: rows.length };
    }
    const like = `%${q}%`;
    const rows = await db
      .prepare(
        `SELECT id, name, first_name, last_name, phone, email,
                formatted_address, is_recurring, created_at
           FROM customers
          WHERE company_id = ?
            AND (name LIKE ? OR email LIKE ? OR phone LIKE ?
                 OR formatted_address LIKE ?)
          ORDER BY created_at DESC LIMIT ${limit}`
      )
      .all(ctx.companyId, like, like, like, like);
    return { customers: rows, count: rows.length };
  },
};

const getCustomer: McpTool = {
  name: "get_customer",
  description:
    "Get a customer with their recent jobs, invoices, and active subscriptions.",
  requiredScope: "crm.read",
  inputSchema: {
    type: "object",
    properties: { id: { type: "number" } },
    required: ["id"],
  },
  async handler(args, ctx) {
    const id = num(args.id, 0);
    if (!id) throw new Error("id is required");
    const db = await getDb();
    const customer = await db
      .prepare(
        "SELECT * FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get(id, ctx.companyId);
    if (!customer) throw new Error("Customer not found");
    const jobs = await db
      .prepare(
        `SELECT id, scheduled_at, status, price_cents FROM jobs
           WHERE customer_id = ? AND company_id = ?
           ORDER BY scheduled_at DESC LIMIT 20`
      )
      .all(id, ctx.companyId);
    const invoices = await db
      .prepare(
        `SELECT id, status, total_cents, paid_cents, due_date, created_at
           FROM invoices WHERE customer_id = ? AND company_id = ?
           ORDER BY created_at DESC LIMIT 20`
      )
      .all(id, ctx.companyId);
    const subscriptions = await db
      .prepare(
        `SELECT id, name, status, price_cents, interval, start_date
           FROM customer_subscriptions
           WHERE customer_id = ? AND company_id = ?
           ORDER BY created_at DESC`
      )
      .all(id, ctx.companyId);
    return { customer, jobs, invoices, subscriptions };
  },
};

const listInvoices: McpTool = {
  name: "list_invoices",
  description: "List invoices, optionally filtered by status or date range.",
  requiredScope: "crm.read",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      limit: { type: "number" },
    },
  },
  async handler(args, ctx) {
    const db = await getDb();
    const where: string[] = ["i.company_id = ?"];
    const params: unknown[] = [ctx.companyId];
    if (str(args.status)) {
      where.push("i.status = ?");
      params.push(args.status);
    }
    if (str(args.from)) {
      where.push("i.created_at >= ?");
      params.push(args.from);
    }
    if (str(args.to)) {
      where.push("i.created_at < ?");
      params.push(args.to);
    }
    const limit = num(args.limit, 50, 200);
    const rows = await db
      .prepare(
        `SELECT i.id, i.status, i.total_cents, i.paid_cents, i.due_date,
                i.created_at, i.customer_id, c.name AS customer_name
           FROM invoices i JOIN customers c ON c.id = i.customer_id
          WHERE ${where.join(" AND ")}
          ORDER BY i.created_at DESC LIMIT ${limit}`
      )
      .all(...(params as never[]));
    return { invoices: rows, count: rows.length };
  },
};

const getPlStatement: McpTool = {
  name: "get_pl_statement",
  description:
    "Build a profit-and-loss summary for a date range. Income is the sum of collected payments grouped by payment method. Pass `from` and `to` as ISO dates (inclusive/exclusive).",
  requiredScope: "crm.read",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string" },
      to: { type: "string" },
    },
    required: ["from", "to"],
  },
  async handler(args, ctx) {
    const from = str(args.from);
    const to = str(args.to);
    if (!from || !to) throw new Error("from and to are required");
    const db = await getDb();
    const income = await db
      .prepare(
        `SELECT
           COALESCE(SUM(amount_cents), 0) AS total_cents,
           COALESCE(SUM(tip_cents), 0) AS tip_cents,
           COUNT(*) AS payment_count
         FROM payments
         WHERE company_id = ? AND payment_date >= ? AND payment_date < ?`
      )
      .get<{ total_cents: number; tip_cents: number; payment_count: number }>(
        ctx.companyId,
        from,
        to
      );
    const byMethod = await db
      .prepare(
        `SELECT method, COALESCE(SUM(amount_cents), 0) AS total_cents
           FROM payments
          WHERE company_id = ? AND payment_date >= ? AND payment_date < ?
          GROUP BY method`
      )
      .all(ctx.companyId, from, to);
    const gross = income?.total_cents ?? 0;
    const tips = income?.tip_cents ?? 0;
    return {
      period: { from, to },
      income: {
        total_cents: gross,
        tip_cents: tips,
        payments_recorded: income?.payment_count ?? 0,
        by_method: byMethod,
      },
      note: "Expenses tracking not yet wired in v1 of the connector; this report covers income only.",
    };
  },
};

const rescheduleJob: McpTool = {
  name: "reschedule_job",
  description:
    "Move a job to a new start time (and optional new end time). Use this for 'reschedule due to rain' style requests. The schedule columns are also re-indexed.",
  requiredScope: "crm.write",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "number" },
      scheduled_at: {
        type: "string",
        description: "New start time as ISO 8601",
      },
      end_time: { type: "string", description: "Optional new end time" },
    },
    required: ["id", "scheduled_at"],
  },
  async handler(args, ctx) {
    const id = num(args.id, 0);
    const scheduledAt = str(args.scheduled_at);
    const endTime = str(args.end_time);
    if (!id || !scheduledAt)
      throw new Error("id and scheduled_at are required");
    const db = await getDb();
    const row = await db
      .prepare(
        "SELECT id FROM jobs WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get(id, ctx.companyId);
    if (!row) throw new Error("Job not found");
    if (endTime) {
      await db
        .prepare(
          `UPDATE jobs SET scheduled_at = ?, end_time = ?
             WHERE id = ? AND company_id = ?`
        )
        .run(scheduledAt, endTime, id, ctx.companyId);
    } else {
      await db
        .prepare(
          `UPDATE jobs SET scheduled_at = ?
             WHERE id = ? AND company_id = ?`
        )
        .run(scheduledAt, id, ctx.companyId);
    }
    return { ok: true, id, scheduled_at: scheduledAt, end_time: endTime };
  },
};

const updateJobStatus: McpTool = {
  name: "update_job_status",
  description:
    "Set a job's status. Allowed: scheduled, in_progress, completed, cancelled.",
  requiredScope: "crm.write",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "number" },
      status: { type: "string" },
    },
    required: ["id", "status"],
  },
  async handler(args, ctx) {
    const id = num(args.id, 0);
    const status = str(args.status);
    const allowed = ["scheduled", "in_progress", "completed", "cancelled"];
    if (!id || !status || !allowed.includes(status))
      throw new Error(`status must be one of: ${allowed.join(", ")}`);
    const db = await getDb();
    const r = await db
      .prepare(
        "UPDATE jobs SET status = ? WHERE id = ? AND company_id = ?"
      )
      .run(status, id, ctx.companyId);
    if (r.changes === 0) throw new Error("Job not found");
    return { ok: true, id, status };
  },
};

const createCustomerNote: McpTool = {
  name: "create_customer_note",
  description:
    "Append a free-form note to a customer's record. The note is timestamped and authored as the connected user.",
  requiredScope: "crm.write",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "number" },
      note: { type: "string" },
    },
    required: ["customer_id", "note"],
  },
  async handler(args, ctx) {
    const id = num(args.customer_id, 0);
    const note = str(args.note);
    if (!id || !note) throw new Error("customer_id and note are required");
    const db = await getDb();
    const existing = await db
      .prepare(
        "SELECT notes FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get<{ notes: string | null }>(id, ctx.companyId);
    if (!existing) throw new Error("Customer not found");
    const stamp = new Date().toISOString();
    const author = ctx.staffId ? `staff#${ctx.staffId}` : "claude";
    const appended = `${existing.notes ? existing.notes + "\n\n" : ""}[${stamp} via ${author}] ${note}`;
    await db
      .prepare(
        "UPDATE customers SET notes = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?"
      )
      .run(appended, id, ctx.companyId);
    return { ok: true, customer_id: id };
  },
};

const sendCustomerSms: McpTool = {
  name: "send_customer_sms",
  description:
    "Send an SMS to a customer from this company's Twilio number. The customer must have a phone number on file and not be opted out. Use this to notify customers about reschedules or send reminders.",
  requiredScope: "crm.messaging",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "number" },
      body: {
        type: "string",
        description: "Message body. Plain text; do not include opt-out footer.",
      },
    },
    required: ["customer_id", "body"],
  },
  async handler(args, ctx) {
    const id = num(args.customer_id, 0);
    const body = str(args.body);
    if (!id || !body) throw new Error("customer_id and body are required");
    const db = await getDb();
    const customer = await db
      .prepare(
        "SELECT id, phone FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get<{ id: number; phone: string | null }>(id, ctx.companyId);
    if (!customer) throw new Error("Customer not found");
    if (!customer.phone) throw new Error("Customer has no phone on file");
    const to = normalizeUSPhone(customer.phone);
    if (!to) throw new Error("Customer phone is not a valid US number");
    const result = await sendCompanySms({
      companyId: ctx.companyId,
      to,
      body,
    });
    if (!result.ok) {
      throw new Error(`SMS send failed: ${result.error}`);
    }
    return { ok: true, sid: result.sid, customer_id: id };
  },
};

const sendCustomerEmail: McpTool = {
  name: "send_customer_email",
  description:
    "Send an email to a customer from this company's configured sender. Pass plain text or simple HTML in `body`. Subject is required.",
  requiredScope: "crm.messaging",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "number" },
      subject: { type: "string" },
      body: { type: "string", description: "Plain text or HTML" },
    },
    required: ["customer_id", "subject", "body"],
  },
  async handler(args, ctx) {
    const id = num(args.customer_id, 0);
    const subject = str(args.subject);
    const body = str(args.body);
    if (!id || !subject || !body)
      throw new Error("customer_id, subject, body are required");
    const db = await getDb();
    const customer = await db
      .prepare(
        "SELECT id, email, name FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get<{ id: number; email: string | null; name: string | null }>(
        id,
        ctx.companyId
      );
    if (!customer) throw new Error("Customer not found");
    if (!customer.email) throw new Error("Customer has no email on file");
    const sender = await resolveEmailSender(ctx.companyId);
    if (!sender) {
      throw new Error(
        "Email sender is not configured for this company. Set it in Settings → Email."
      );
    }
    const isHtml = /<[a-z][\s\S]*>/i.test(body);
    const res = await sendEmailViaResend({
      sender,
      to: customer.email,
      subject,
      html: isHtml
        ? body
        : `<pre style="font-family:inherit">${escapeHtml(body)}</pre>`,
      text: isHtml ? undefined : body,
    });
    if (!res.ok) throw new Error(`Email send failed: ${res.error}`);
    return { ok: true, id: res.id, customer_id: id };
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const MCP_TOOLS: McpTool[] = [
  listJobs,
  getJob,
  listCustomers,
  getCustomer,
  listInvoices,
  getPlStatement,
  rescheduleJob,
  updateJobStatus,
  createCustomerNote,
  sendCustomerSms,
  sendCustomerEmail,
];

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
