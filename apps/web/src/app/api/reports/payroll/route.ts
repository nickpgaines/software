import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";

export const dynamic = "force-dynamic";

type StaffRow = {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  permission_level: string;
  sales_commission_rate: number;
  tech_commission_rate: number;
};

type RevenueRow = { staff_id: number; revenue: number };
type TipsRow = { staff_id: number; tips: number };
type PaidRow = { staff_id: number; role: "sales" | "tech" };

function displayName(s: StaffRow): string {
  const fn = (s.first_name || "").trim();
  const ln = (s.last_name || "").trim();
  const joined = [fn, ln].filter(Boolean).join(" ").trim();
  return joined || (s.name || "").trim() || `Staff #${s.id}`;
}

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRange(url.searchParams.get("range"));
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const staff = await db
    .prepare(
      `SELECT id, name, first_name, last_name, email, permission_level,
              sales_commission_rate, tech_commission_rate
         FROM staff
        ORDER BY COALESCE(first_name, name), last_name`
    )
    .all<StaffRow>();

  const salesRevenue = await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(j.price_cents), 0) AS revenue
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
        WHERE ja.role = 'sales'
          AND j.scheduled_at >= ? AND j.scheduled_at < ?
        GROUP BY ja.staff_id`
    )
    .all<RevenueRow>(startIso, endIso);

  const techRevenue = await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(j.price_cents), 0) AS revenue
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
        WHERE ja.role = 'tech'
          AND j.scheduled_at >= ? AND j.scheduled_at < ?
        GROUP BY ja.staff_id`
    )
    .all<RevenueRow>(startIso, endIso);

  const techTips = await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(p.tip_cents), 0) AS tips
         FROM payments p
         JOIN job_assignments ja ON ja.job_id = p.job_id
        WHERE ja.role = 'tech'
          AND p.payment_date >= ? AND p.payment_date < ?
        GROUP BY ja.staff_id`
    )
    .all<TipsRow>(startIso, endIso);

  const paidRows = await db
    .prepare(
      `SELECT staff_id, role
         FROM payroll_payouts
        WHERE period_start = ? AND period_end = ?`
    )
    .all<PaidRow>(startIso, endIso);

  const totalRevenueRow = (await db
    .prepare(
      `SELECT COALESCE(SUM(price_cents), 0) AS total
         FROM jobs
        WHERE scheduled_at >= ? AND scheduled_at < ?`
    )
    .get<{ total: number }>(startIso, endIso)) || { total: 0 };

  const totalTipsRow = (await db
    .prepare(
      `SELECT COALESCE(SUM(tip_cents), 0) AS total
         FROM payments
        WHERE payment_date >= ? AND payment_date < ?`
    )
    .get<{ total: number }>(startIso, endIso)) || { total: 0 };

  const salesRevById = new Map(salesRevenue.map((r) => [r.staff_id, r.revenue]));
  const techRevById = new Map(techRevenue.map((r) => [r.staff_id, r.revenue]));
  const techTipsById = new Map(techTips.map((r) => [r.staff_id, r.tips]));
  const paidSet = new Set(paidRows.map((r) => `${r.staff_id}:${r.role}`));

  const sales = staff.map((s) => {
    const rate = Number(s.sales_commission_rate) || 0;
    const revenue = salesRevById.get(s.id) || 0;
    const payout = Math.round(revenue * rate);
    return {
      id: s.id,
      name: displayName(s),
      email: s.email,
      role: s.permission_level,
      rate,
      total_cents: revenue,
      tips_cents: 0,
      payout_cents: payout,
      paid: paidSet.has(`${s.id}:sales`),
    };
  });

  const tech = staff.map((s) => {
    const rate = Number(s.tech_commission_rate) || 0;
    const revenue = techRevById.get(s.id) || 0;
    const tips = techTipsById.get(s.id) || 0;
    const payout = Math.round(revenue * rate) + tips;
    return {
      id: s.id,
      name: displayName(s),
      email: s.email,
      role: s.permission_level,
      rate,
      total_cents: revenue,
      tips_cents: tips,
      payout_cents: payout,
      paid: paidSet.has(`${s.id}:tech`),
    };
  });

  const salesCommission = sales.reduce((sum, r) => sum + r.payout_cents, 0);
  const techCommission = tech.reduce(
    (sum, r) => sum + (r.payout_cents - r.tips_cents),
    0
  );
  const tipsTotal = tech.reduce((sum, r) => sum + r.tips_cents, 0);
  const totalPayout = salesCommission + techCommission + tipsTotal;
  const totalRevenue = totalRevenueRow.total;
  const netProfit = totalRevenue - totalPayout;

  return NextResponse.json({
    range,
    period: { start: startIso, end: endIso },
    sales,
    tech,
    summary: {
      total_revenue_cents: totalRevenue,
      sales_commission_cents: salesCommission,
      tech_commission_cents: techCommission,
      tips_cents: tipsTotal,
      total_payout_cents: totalPayout,
      net_profit_cents: netProfit,
      total_tips_collected_cents: totalTipsRow.total,
    },
  });
}
