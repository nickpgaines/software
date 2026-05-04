import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import type { LiveJob, RevenuePoint, RevenueSummary } from "@/components/pulse/widgets";

export async function getDashboardIdentity(): Promise<{
  firstName: string;
  initials: string;
}> {
  const ctx = await getSessionContext();
  if (!ctx) return { firstName: "there", initials: "?" };
  if (ctx.isPlatformAdmin) return { firstName: "Admin", initials: "A" };
  if (!ctx.staffId) {
    const id = ctx.identity || "";
    return {
      firstName: id || "there",
      initials: (id[0] || "?").toUpperCase(),
    };
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

export async function getTodayJobs(): Promise<LiveJob[]> {
  const ctx = await getSessionContext();
  const companyId = ctx?.companyId ?? 0;
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

export async function getMonthlyRevenue(): Promise<RevenueSummary> {
  const ctx = await getSessionContext();
  const companyId = ctx?.companyId ?? 0;
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
