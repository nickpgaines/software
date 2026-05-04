import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { resolveReportRange, type ReportRange } from "@/lib/report-range";

export type LiveJob = {
  id: number;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: string;
  customer_name: string;
  customer_address: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

export async function getIdentity() {
  const ctx = await getSessionContext();
  const fallback = { firstName: "there", initials: "?" };
  if (!ctx) return fallback;
  if (ctx.isPlatformAdmin) return { firstName: "Admin", initials: "A" };
  if (!ctx.staffId) {
    const id = ctx.identity || "";
    return { firstName: id || "there", initials: (id[0] || "?").toUpperCase() };
  }
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT first_name, name FROM staff WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(ctx.staffId, ctx.companyId)) as
    | { first_name: string | null; name: string | null }
    | undefined;
  const full = (row?.name ?? ctx.identity ?? "").trim();
  const first = (row?.first_name ?? full.split(/\s+/)[0] ?? "").trim() || "there";
  const parts = full.split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? first[0]?.toUpperCase() ?? "?"
      : parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return { firstName: first, initials };
}

export async function getCompanyId() {
  const ctx = await getSessionContext();
  return ctx?.companyId ?? 0;
}

export async function getTodayJobs(): Promise<LiveJob[]> {
  const companyId = await getCompanyId();
  const db = await getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (await db
    .prepare(
      `SELECT j.id, j.scheduled_at, j.duration_minutes, j.price_cents, j.status,
              c.name AS customer_name,
              c.address AS customer_address,
              sp.name AS salesperson_name,
              tc.name AS technician_name
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN staff sp ON sp.id = j.salesperson_id
       LEFT JOIN staff tc ON tc.id = j.technician_id
       WHERE j.company_id = ?
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       ORDER BY j.scheduled_at ASC`
    )
    .all(companyId, today.toISOString(), tomorrow.toISOString())) as LiveJob[];
}

export async function getUpcomingJobs(days = 14): Promise<LiveJob[]> {
  const companyId = await getCompanyId();
  const db = await getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return (await db
    .prepare(
      `SELECT j.id, j.scheduled_at, j.duration_minutes, j.price_cents, j.status,
              c.name AS customer_name,
              c.address AS customer_address,
              sp.name AS salesperson_name,
              tc.name AS technician_name
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN staff sp ON sp.id = j.salesperson_id
       LEFT JOIN staff tc ON tc.id = j.technician_id
       WHERE j.company_id = ?
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       ORDER BY j.scheduled_at ASC
       LIMIT 100`
    )
    .all(companyId, start.toISOString(), end.toISOString())) as LiveJob[];
}

export type RevenuePoint = { date: string; cents: number };
export type RevenueSummary = {
  totalCents: number;
  jobsCompleted: number;
  customersCount: number;
  daily: RevenuePoint[];
};

export async function getRevenueThisMonth(): Promise<RevenueSummary> {
  const companyId = await getCompanyId();
  const db = await getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const rows = (await db
    .prepare(
      `SELECT scheduled_at, price_cents, status
       FROM jobs
       WHERE company_id = ?
         AND scheduled_at >= ? AND scheduled_at < ?`
    )
    .all(companyId, start.toISOString(), end.toISOString())) as {
    scheduled_at: string;
    price_cents: number;
    status: string;
  }[];

  const totalCents = rows.reduce((sum, r) => sum + (r.price_cents || 0), 0);
  const jobsCompleted = rows.filter((r) => r.status === "completed").length;

  const customersRow = (await db
    .prepare("SELECT COUNT(*) AS n FROM customers WHERE company_id = ?")
    .get(companyId)) as { n: number } | undefined;
  const customersCount = customersRow?.n ?? 0;

  const dailyMap = new Map<string, number>();
  const cursor = new Date(start);
  while (cursor < end) {
    const k = cursor.toISOString().slice(0, 10);
    dailyMap.set(k, 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const r of rows) {
    const k = new Date(r.scheduled_at).toISOString().slice(0, 10);
    if (dailyMap.has(k)) dailyMap.set(k, (dailyMap.get(k) || 0) + (r.price_cents || 0));
  }
  const daily: RevenuePoint[] = Array.from(dailyMap.entries()).map(([date, cents]) => ({
    date,
    cents,
  }));

  return { totalCents, jobsCompleted, customersCount, daily };
}

export type ReportsOverview = {
  range: ReportRange;
  revenue: {
    total_cents: number;
    collected_cents: number;
    unpaid_cents: number;
    collection_rate: number;
  };
  jobs: {
    total: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    avg_value_cents: number;
  };
  customers: {
    total: number;
    new: number;
    repeat: number;
  };
};

// Mirrors /api/reports/overview so the redesigned Reports view can show the
// same numbers as the live Forge CRM Reports tab.
export async function getReportsOverview(
  range: ReportRange = "1m"
): Promise<ReportsOverview> {
  const companyId = await getCompanyId();
  const db = await getDb();
  const { range: r, start, end } = resolveReportRange(range);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const revenue = (await db
    .prepare(
      `SELECT
         COALESCE(SUM(price_cents), 0) AS total,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN price_cents ELSE 0 END), 0) AS collected,
         COALESCE(SUM(CASE WHEN status = 'scheduled' THEN price_cents ELSE 0 END), 0) AS unpaid
       FROM jobs
       WHERE company_id = ?
         AND scheduled_at >= ? AND scheduled_at < ?`
    )
    .get(companyId, startIso, endIso)) as {
    total: number;
    collected: number;
    unpaid: number;
  };
  const collectionRate = revenue.total > 0 ? revenue.collected / revenue.total : 0;

  const jobs = (await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
         COALESCE(SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END), 0) AS scheduled,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
         COALESCE(AVG(price_cents), 0) AS avg_value
       FROM jobs
       WHERE company_id = ?
         AND scheduled_at >= ? AND scheduled_at < ?`
    )
    .get(companyId, startIso, endIso)) as {
    total: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    avg_value: number;
  };

  const totalCustomers = (
    (await db
      .prepare("SELECT COUNT(*) AS n FROM customers WHERE company_id = ?")
      .get(companyId)) as { n: number }
  ).n;
  const newCustomers = (
    (await db
      .prepare(
        "SELECT COUNT(*) AS n FROM customers WHERE company_id = ? AND created_at >= ? AND created_at < ?"
      )
      .get(companyId, startIso, endIso)) as { n: number }
  ).n;
  const repeatCustomers = (
    (await db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT customer_id FROM jobs
            WHERE company_id = ?
            GROUP BY customer_id HAVING COUNT(*) > 1
         )`
      )
      .get(companyId)) as { n: number }
  ).n;

  return {
    range: r,
    revenue: {
      total_cents: revenue.total,
      collected_cents: revenue.collected,
      unpaid_cents: revenue.unpaid,
      collection_rate: collectionRate,
    },
    jobs: {
      total: jobs.total,
      completed: jobs.completed,
      scheduled: jobs.scheduled,
      cancelled: jobs.cancelled,
      avg_value_cents: Math.round(jobs.avg_value),
    },
    customers: {
      total: totalCustomers,
      new: newCustomers,
      repeat: repeatCustomers,
    },
  };
}

export type LeaderRow = {
  id: number;
  name: string;
  jobs: number;
  revenueCents: number;
};

export async function getLeaderboard(): Promise<LeaderRow[]> {
  const companyId = await getCompanyId();
  const db = await getDb();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const staff = (await db
    .prepare("SELECT id, name FROM staff WHERE company_id = ? ORDER BY name ASC")
    .all(companyId)) as { id: number; name: string }[];
  const out: LeaderRow[] = [];
  for (const s of staff) {
    const row = (await db
      .prepare(
        `SELECT COUNT(*) AS jobs, COALESCE(SUM(price_cents), 0) AS rev
         FROM jobs
         WHERE company_id = ? AND scheduled_at >= ?
           AND (salesperson_id = ? OR technician_id = ?)`
      )
      .get(companyId, start.toISOString(), s.id, s.id)) as
      | { jobs: number; rev: number }
      | undefined;
    out.push({
      id: s.id,
      name: s.name,
      jobs: row?.jobs ?? 0,
      revenueCents: row?.rev ?? 0,
    });
  }
  return out.sort((a, b) => b.revenueCents - a.revenueCents);
}

export type CustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export async function getCustomers(limit = 50): Promise<CustomerRow[]> {
  const companyId = await getCompanyId();
  const db = await getDb();
  return (await db
    .prepare(
      `SELECT id, name, phone, email, address
       FROM customers
       WHERE company_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(companyId, limit)) as CustomerRow[];
}
