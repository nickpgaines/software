import { NextResponse } from "next/server";
import { getDb, type PayrollSettings, type CommissionTier } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

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
type PlanSaleRow = { staff_id: number; sales: number };

function displayName(s: StaffRow): string {
  const fn = (s.first_name || "").trim();
  const ln = (s.last_name || "").trim();
  const joined = [fn, ln].filter(Boolean).join(" ").trim();
  return joined || (s.name || "").trim() || `Staff #${s.id}`;
}

function parseTiers(s: string): CommissionTier[] {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    const out: CommissionTier[] = [];
    for (const t of arr) {
      const threshold = Number(t?.threshold_cents);
      const rate = Number(t?.rate);
      if (Number.isFinite(threshold) && threshold >= 0 && Number.isFinite(rate) && rate >= 0 && rate <= 1) {
        out.push({ threshold_cents: Math.round(threshold), rate });
      }
    }
    out.sort((a, b) => a.threshold_cents - b.threshold_cents);
    return out;
  } catch {
    return [];
  }
}

// Progressive-tier commission: each portion of revenue between consecutive
// thresholds is paid at that tier's rate. If no tier with threshold 0 exists,
// revenue below the lowest threshold pays nothing.
function tieredPayout(revenueCents: number, tiers: CommissionTier[]): number {
  if (revenueCents <= 0 || tiers.length === 0) return 0;
  let payout = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const next = tiers[i + 1];
    if (revenueCents <= tier.threshold_cents) break;
    const upper = next ? next.threshold_cents : revenueCents;
    const portion = Math.min(revenueCents, upper) - tier.threshold_cents;
    if (portion > 0) payout += portion * tier.rate;
  }
  return Math.round(payout);
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRange(url.searchParams.get("range"));
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const settings = (await db
    .prepare(`SELECT * FROM payroll_settings WHERE company_id = ? LIMIT 1`)
    .get<PayrollSettings>(companyId)) || null;

  const excludeOneTime = settings?.exclude_one_time_services === 1;
  const jobFilter = excludeOneTime ? `AND j.recurring = 1` : ``;
  const totalsJobFilter = excludeOneTime ? `AND recurring = 1` : ``;

  const staff = await db
    .prepare(
      `SELECT id, name, first_name, last_name, email, permission_level,
              sales_commission_rate, tech_commission_rate
         FROM staff
        WHERE company_id = ?
        ORDER BY COALESCE(first_name, name), last_name`
    )
    .all<StaffRow>(companyId);

  const salesRevenue = await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(j.price_cents), 0) AS revenue
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
        WHERE ja.role = 'sales'
          AND j.company_id = ?
          AND j.scheduled_at >= ? AND j.scheduled_at < ?
          ${jobFilter}
        GROUP BY ja.staff_id`
    )
    .all<RevenueRow>(companyId, startIso, endIso);

  const techRevenue = await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(j.price_cents), 0) AS revenue
         FROM job_assignments ja
         JOIN jobs j ON j.id = ja.job_id
        WHERE ja.role = 'tech'
          AND j.company_id = ?
          AND j.scheduled_at >= ? AND j.scheduled_at < ?
          ${jobFilter}
        GROUP BY ja.staff_id`
    )
    .all<RevenueRow>(companyId, startIso, endIso);

  const techTips = await db
    .prepare(
      `SELECT ja.staff_id AS staff_id,
              COALESCE(SUM(p.tip_cents), 0) AS tips
         FROM payments p
         JOIN job_assignments ja ON ja.job_id = p.job_id
        WHERE ja.role = 'tech'
          AND p.company_id = ?
          AND p.payment_date >= ? AND p.payment_date < ?
        GROUP BY ja.staff_id`
    )
    .all<TipsRow>(companyId, startIso, endIso);

  const paidRows = await db
    .prepare(
      `SELECT staff_id, role
         FROM payroll_payouts
        WHERE company_id = ?
          AND period_start = ? AND period_end = ?`
    )
    .all<PaidRow>(companyId, startIso, endIso);

  const planSaleRows = settings?.plan_sale_bonuses_enabled
    ? await db
        .prepare(
          `SELECT sold_by_id AS staff_id, COUNT(*) AS sales
             FROM customer_subscriptions
            WHERE company_id = ?
              AND sold_by_id IS NOT NULL
              AND status = 'active'
              AND accepted_at IS NOT NULL
              AND accepted_at >= ? AND accepted_at < ?
            GROUP BY sold_by_id`
        )
        .all<PlanSaleRow>(companyId, startIso, endIso)
    : [];

  const totalRevenueRow = (await db
    .prepare(
      `SELECT COALESCE(SUM(price_cents), 0) AS total
         FROM jobs
        WHERE company_id = ?
          AND scheduled_at >= ? AND scheduled_at < ?
          ${totalsJobFilter}`
    )
    .get<{ total: number }>(companyId, startIso, endIso)) || { total: 0 };

  const totalTipsRow = (await db
    .prepare(
      `SELECT COALESCE(SUM(tip_cents), 0) AS total
         FROM payments
        WHERE company_id = ?
          AND payment_date >= ? AND payment_date < ?`
    )
    .get<{ total: number }>(companyId, startIso, endIso)) || { total: 0 };

  const salesRevById = new Map(salesRevenue.map((r) => [r.staff_id, r.revenue]));
  const techRevById = new Map(techRevenue.map((r) => [r.staff_id, r.revenue]));
  const techTipsById = new Map(techTips.map((r) => [r.staff_id, r.tips]));
  const paidSet = new Set(paidRows.map((r) => `${r.staff_id}:${r.role}`));
  const planSalesById = new Map(planSaleRows.map((r) => [r.staff_id, r.sales]));

  const salesMode = settings?.sales_commission_mode || "flat";
  const techMode = settings?.tech_commission_mode || "flat";
  const salesTiers = parseTiers(settings?.sales_commission_tiers ?? "[]");
  const techTiers = parseTiers(settings?.tech_commission_tiers ?? "[]");
  const planBonusCents =
    settings?.plan_sale_bonuses_enabled && settings.plan_sale_bonus_cents > 0
      ? settings.plan_sale_bonus_cents
      : 0;

  const sales = staff.map((s) => {
    const revenue = salesRevById.get(s.id) || 0;
    const planBonus = (planSalesById.get(s.id) || 0) * planBonusCents;
    let baseCommission = 0;
    let effectiveRate = Number(s.sales_commission_rate) || 0;
    if (salesMode === "tiers") {
      baseCommission = tieredPayout(revenue, salesTiers);
      effectiveRate = revenue > 0 ? baseCommission / revenue : 0;
    } else {
      baseCommission = Math.round(revenue * effectiveRate);
    }
    return {
      id: s.id,
      name: displayName(s),
      email: s.email,
      role: s.permission_level,
      rate: effectiveRate,
      total_cents: revenue,
      tips_cents: 0,
      bonus_cents: planBonus,
      payout_cents: baseCommission + planBonus,
      paid: paidSet.has(`${s.id}:sales`),
    };
  });

  const tech = staff.map((s) => {
    const revenue = techRevById.get(s.id) || 0;
    const tips = techTipsById.get(s.id) || 0;
    let baseCommission = 0;
    let effectiveRate = Number(s.tech_commission_rate) || 0;
    if (techMode === "tiers") {
      baseCommission = tieredPayout(revenue, techTiers);
      effectiveRate = revenue > 0 ? baseCommission / revenue : 0;
    } else {
      baseCommission = Math.round(revenue * effectiveRate);
    }
    return {
      id: s.id,
      name: displayName(s),
      email: s.email,
      role: s.permission_level,
      rate: effectiveRate,
      total_cents: revenue,
      tips_cents: tips,
      bonus_cents: 0,
      payout_cents: baseCommission + tips,
      paid: paidSet.has(`${s.id}:tech`),
    };
  });

  const salesCommission = sales.reduce(
    (sum, r) => sum + (r.payout_cents - r.bonus_cents),
    0
  );
  const techCommission = tech.reduce(
    (sum, r) => sum + (r.payout_cents - r.tips_cents),
    0
  );
  const tipsTotal = tech.reduce((sum, r) => sum + r.tips_cents, 0);
  const planBonusTotal = sales.reduce((sum, r) => sum + r.bonus_cents, 0);
  const totalPayout = salesCommission + techCommission + tipsTotal + planBonusTotal;
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
      plan_sale_bonus_cents: planBonusTotal,
      total_payout_cents: totalPayout,
      net_profit_cents: netProfit,
      total_tips_collected_cents: totalTipsRow.total,
    },
    settings: settings,
  });
}
