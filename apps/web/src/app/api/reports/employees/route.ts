import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type StaffRow = {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  permission_level: string | null;
  created_at: string;
};

type RevenueRow = { staff_id: number; revenue: number; minutes: number };

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 30.4375;

function displayName(s: StaffRow): string {
  const fn = (s.first_name || "").trim();
  const ln = (s.last_name || "").trim();
  const joined = [fn, ln].filter(Boolean).join(" ").trim();
  return joined || (s.name || "").trim() || `Staff #${s.id}`;
}

function tenureDays(createdAt: string, now: number): number {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 1;
  const days = (now - created) / MS_PER_DAY;
  return Math.max(1, days);
}

function safeAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const now = Date.now();

  const staff = (await db
    .prepare(
      `SELECT id, name, first_name, last_name, email, permission_level, created_at
         FROM staff
        WHERE company_id = ?`
    )
    .all(companyId)) as StaffRow[];

  const salesRevenue = (await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(j.price_cents), 0) AS revenue,
              COALESCE(SUM(j.duration_minutes), 0) AS minutes
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
        WHERE ja.role = 'sales'
          AND j.company_id = ?
          AND j.status != 'cancelled'
        GROUP BY ja.staff_id`
    )
    .all(companyId)) as RevenueRow[];

  const techRevenue = (await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(j.price_cents), 0) AS revenue,
              COALESCE(SUM(j.duration_minutes), 0) AS minutes
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
        WHERE ja.role = 'tech'
          AND j.company_id = ?
          AND j.status != 'cancelled'
        GROUP BY ja.staff_id`
    )
    .all(companyId)) as RevenueRow[];

  const salesById = new Map(salesRevenue.map((r) => [r.staff_id, r]));
  const techById = new Map(techRevenue.map((r) => [r.staff_id, r]));
  const staffById = new Map(staff.map((s) => [s.id, s]));

  type SalesOut = {
    id: number;
    name: string;
    email: string | null;
    days_active: number;
    months_active: number;
    lifetime_revenue_cents: number;
    avg_monthly_revenue_cents: number;
    avg_daily_revenue_cents: number;
  };

  type TechOut = SalesOut & {
    minutes_worked: number;
    avg_dollar_per_hour_cents: number;
  };

  const salesIds = new Set<number>(salesRevenue.map((r) => r.staff_id));
  for (const s of staff) {
    if (s.permission_level && s.permission_level.startsWith("salesperson")) {
      salesIds.add(s.id);
    }
  }

  const techIds = new Set<number>(techRevenue.map((r) => r.staff_id));
  for (const s of staff) {
    if (
      s.permission_level === "field_tech" ||
      s.permission_level === "team_lead"
    ) {
      techIds.add(s.id);
    }
  }

  function buildRow(staffId: number, source: "sales" | "tech"): SalesOut & {
    minutes_worked: number;
  } {
    const s = staffById.get(staffId);
    const data = source === "sales" ? salesById.get(staffId) : techById.get(staffId);
    const lifetime = data?.revenue || 0;
    const minutes = data?.minutes || 0;
    const days = s ? tenureDays(s.created_at, now) : 1;
    const months = days / DAYS_PER_MONTH;
    return {
      id: staffId,
      name: s ? displayName(s) : `Staff #${staffId}`,
      email: s?.email || null,
      days_active: days,
      months_active: months,
      lifetime_revenue_cents: lifetime,
      avg_monthly_revenue_cents: months > 0 ? Math.round(lifetime / months) : 0,
      avg_daily_revenue_cents: days > 0 ? Math.round(lifetime / days) : 0,
      minutes_worked: minutes,
    };
  }

  const sales: SalesOut[] = Array.from(salesIds)
    .map((id) => buildRow(id, "sales"))
    .sort((a, b) => b.lifetime_revenue_cents - a.lifetime_revenue_cents);

  const tech: TechOut[] = Array.from(techIds)
    .map((id) => buildRow(id, "tech"))
    .map((r) => ({
      ...r,
      avg_dollar_per_hour_cents:
        r.minutes_worked > 0
          ? Math.round((r.lifetime_revenue_cents * 60) / r.minutes_worked)
          : 0,
    }))
    .sort((a, b) => b.lifetime_revenue_cents - a.lifetime_revenue_cents);

  const aggregates = {
    sales_avg_monthly_cents: Math.round(
      safeAvg(sales.map((r) => r.avg_monthly_revenue_cents))
    ),
    sales_avg_lifetime_cents: Math.round(
      safeAvg(sales.map((r) => r.lifetime_revenue_cents))
    ),
    sales_avg_daily_cents: Math.round(
      safeAvg(sales.map((r) => r.avg_daily_revenue_cents))
    ),
    tech_avg_monthly_cents: Math.round(
      safeAvg(tech.map((r) => r.avg_monthly_revenue_cents))
    ),
    tech_avg_daily_cents: Math.round(
      safeAvg(tech.map((r) => r.avg_daily_revenue_cents))
    ),
    tech_avg_per_hour_cents: Math.round(
      safeAvg(
        tech
          .filter((r) => r.minutes_worked > 0)
          .map((r) => r.avg_dollar_per_hour_cents)
      )
    ),
  };

  return NextResponse.json({
    sales,
    tech,
    aggregates,
  });
}
