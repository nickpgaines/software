import { getDb, type CommissionTier, type PayrollSettings } from "@/lib/db";

export function parseTiers(s: string): CommissionTier[] {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    const out: CommissionTier[] = [];
    for (const t of arr) {
      const threshold = Number(t?.threshold_cents);
      const rate = Number(t?.rate);
      if (
        Number.isFinite(threshold) &&
        threshold >= 0 &&
        Number.isFinite(rate) &&
        rate >= 0 &&
        rate <= 1
      ) {
        out.push({ threshold_cents: Math.round(threshold), rate });
      }
    }
    out.sort((a, b) => a.threshold_cents - b.threshold_cents);
    return out;
  } catch {
    return [];
  }
}

export function tieredPayout(revenueCents: number, tiers: CommissionTier[]): number {
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

export type PayrollSummary = {
  total_revenue_cents: number;
  sales_commission_cents: number;
  tech_commission_cents: number;
  tips_cents: number;
  plan_sale_bonus_cents: number;
  total_payout_cents: number;
  net_profit_cents: number;
};

/**
 * Period-scoped payroll summary: total revenue, total commissions/tips/bonuses,
 * and net-profit proxy. Mirrors the per-staff math in
 * `/api/reports/payroll/route.ts` so both surfaces stay in sync.
 */
export async function getPayrollSummary(
  companyId: number,
  startIso: string,
  endIso: string,
): Promise<PayrollSummary> {
  const db = await getDb();
  const settings =
    (await db
      .prepare(`SELECT * FROM payroll_settings WHERE company_id = ? LIMIT 1`)
      .get<PayrollSettings>(companyId)) || null;

  const excludeOneTime = settings?.exclude_one_time_services === 1;
  const jobFilter = excludeOneTime ? `AND j.recurring = 1` : ``;
  const totalsFilter = excludeOneTime ? `AND recurring = 1` : ``;

  const staff = await db
    .prepare(
      `SELECT id, sales_commission_rate, tech_commission_rate
         FROM staff WHERE company_id = ?`
    )
    .all<{ id: number; sales_commission_rate: number; tech_commission_rate: number }>(
      companyId,
    );

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
    .all<{ staff_id: number; revenue: number }>(companyId, startIso, endIso);

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
    .all<{ staff_id: number; revenue: number }>(companyId, startIso, endIso);

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
        .all<{ staff_id: number; sales: number }>(companyId, startIso, endIso)
    : [];

  const totalRevenueRow =
    (await db
      .prepare(
        `SELECT COALESCE(SUM(price_cents), 0) AS total
           FROM jobs
          WHERE company_id = ?
            AND scheduled_at >= ? AND scheduled_at < ?
            ${totalsFilter}`
      )
      .get<{ total: number }>(companyId, startIso, endIso)) || { total: 0 };

  const totalTipsRow =
    (await db
      .prepare(
        `SELECT COALESCE(SUM(tip_cents), 0) AS total
           FROM payments
          WHERE company_id = ?
            AND payment_date >= ? AND payment_date < ?`
      )
      .get<{ total: number }>(companyId, startIso, endIso)) || { total: 0 };

  const salesRevById = new Map(salesRevenue.map((r) => [r.staff_id, r.revenue]));
  const techRevById = new Map(techRevenue.map((r) => [r.staff_id, r.revenue]));
  const planSalesById = new Map(planSaleRows.map((r) => [r.staff_id, r.sales]));

  const salesMode = settings?.sales_commission_mode || "flat";
  const techMode = settings?.tech_commission_mode || "flat";
  const salesTiers = parseTiers(settings?.sales_commission_tiers ?? "[]");
  const techTiers = parseTiers(settings?.tech_commission_tiers ?? "[]");
  const planBonusCents =
    settings?.plan_sale_bonuses_enabled && settings.plan_sale_bonus_cents > 0
      ? settings.plan_sale_bonus_cents
      : 0;

  let salesCommission = 0;
  let techCommission = 0;
  let planBonusTotal = 0;
  for (const s of staff) {
    const sRev = salesRevById.get(s.id) || 0;
    if (salesMode === "tiers") {
      salesCommission += tieredPayout(sRev, salesTiers);
    } else {
      salesCommission += Math.round(sRev * (Number(s.sales_commission_rate) || 0));
    }
    const tRev = techRevById.get(s.id) || 0;
    if (techMode === "tiers") {
      techCommission += tieredPayout(tRev, techTiers);
    } else {
      techCommission += Math.round(tRev * (Number(s.tech_commission_rate) || 0));
    }
    planBonusTotal += (planSalesById.get(s.id) || 0) * planBonusCents;
  }

  const totalRevenue = totalRevenueRow.total;
  const tips = totalTipsRow.total;
  const totalPayout = salesCommission + techCommission + tips + planBonusTotal;

  return {
    total_revenue_cents: totalRevenue,
    sales_commission_cents: salesCommission,
    tech_commission_cents: techCommission,
    tips_cents: tips,
    plan_sale_bonus_cents: planBonusTotal,
    total_payout_cents: totalPayout,
    net_profit_cents: totalRevenue - totalPayout,
  };
}
