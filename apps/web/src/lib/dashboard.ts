import { getDb, syncReplica } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { getMRRSnapshot, getARRAdded } from "@/lib/revenue";
import type {
  LiveJob,
  RevenuePoint,
  RevenueSummary,
} from "@/components/pulse/types";

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
  type Row = { first_name: string | null; name: string | null };
  const sql =
    "SELECT first_name, name FROM staff WHERE id = ? AND company_id = ? LIMIT 1";
  let row = (await db.prepare(sql).get(ctx.staffId, ctx.companyId)) as
    | Row
    | undefined;
  // The session cookie carries a real staffId, so a missing row almost
  // always means the embedded replica on this instance hasn't synced the
  // signup write yet. Force a sync and retry once before falling back to
  // "there" — that fallback would render "Good afternoon, there" right
  // after a fresh signup, which is the bug we're fixing here.
  if (!row) {
    await syncReplica();
    row = (await db.prepare(sql).get(ctx.staffId, ctx.companyId)) as
      | Row
      | undefined;
  }
  const rawName = (row?.name ?? "").trim();
  const full = rawName.includes("@") ? "" : rawName;
  const rawFirst = (row?.first_name ?? "").trim();
  const candidate = rawFirst && !rawFirst.includes("@")
    ? rawFirst
    : full.split(/\s+/)[0] ?? "";
  const first = candidate.trim() || "there";
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

export type DashboardKpis = {
  closeRate: number;
  closeRateDeltaPp: number;
  arrCents: number;
  arrDeltaPct: number;
  jobsSold: number;
  jobsSoldDelta: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const ctx = await getSessionContext();
  const companyId = ctx?.companyId ?? 0;
  const db = await getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorEnd = monthStart;

  const monthStartIso = monthStart.toISOString();
  const monthEndIso = monthEnd.toISOString();
  const priorStartIso = priorStart.toISOString();
  const priorEndIso = priorEnd.toISOString();

  async function pinCloseRate(
    startIso: string,
    endIso: string,
  ): Promise<number> {
    const row = (await db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'sale' THEN 1 ELSE 0 END), 0) AS sales,
           COALESCE(SUM(CASE WHEN status IN ('sale', 'quote_sent') THEN 1 ELSE 0 END), 0) AS quoted
         FROM map_pins
         WHERE company_id = ?
           AND created_at >= ? AND created_at < ?`
      )
      .get(companyId, startIso, endIso)) as
      | { sales: number; quoted: number }
      | undefined;
    const sales = row?.sales ?? 0;
    const quoted = row?.quoted ?? 0;
    return quoted > 0 ? sales / quoted : 0;
  }

  async function jobsSoldCount(
    startIso: string,
    endIso: string,
  ): Promise<number> {
    const row = (await db
      .prepare(
        `SELECT COUNT(*) AS n FROM jobs
          WHERE company_id = ?
            AND status != 'cancelled'
            AND scheduled_at >= ? AND scheduled_at < ?`
      )
      .get(companyId, startIso, endIso)) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  const [
    closeRate,
    priorCloseRate,
    jobsSold,
    priorJobsSold,
    mrrCents,
    arrAddedCurrent,
  ] = await Promise.all([
    pinCloseRate(monthStartIso, monthEndIso),
    pinCloseRate(priorStartIso, priorEndIso),
    jobsSoldCount(monthStartIso, monthEndIso),
    jobsSoldCount(priorStartIso, priorEndIso),
    getMRRSnapshot(companyId),
    getARRAdded(companyId, monthStartIso, monthEndIso),
  ]);

  const arrCents = mrrCents * 12;
  // ARR at the start of the current month = current ARR minus net ARR added
  // during the month. If non-positive (e.g. brand-new tenant) the delta is 0.
  const arrAtStart = arrCents - arrAddedCurrent.net_added_cents;
  const arrDeltaPct = arrAtStart > 0 ? arrAddedCurrent.net_added_cents / arrAtStart : 0;

  return {
    closeRate,
    closeRateDeltaPp: closeRate - priorCloseRate,
    arrCents,
    arrDeltaPct,
    jobsSold,
    jobsSoldDelta: jobsSold - priorJobsSold,
  };
}
