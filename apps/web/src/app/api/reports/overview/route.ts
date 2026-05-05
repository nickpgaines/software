import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRangeFromUrl } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";
import {
  getCollectedRevenue,
  getGeneratedRevenue,
  getMRRSnapshot,
  getARRAdded,
} from "@/lib/revenue";
import { getPayrollSummary } from "@/lib/payroll-calc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRangeFromUrl(url);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [collected, generated, mrrCents, arrAdded, payroll] = await Promise.all([
    getCollectedRevenue(companyId, startIso, endIso),
    getGeneratedRevenue(companyId, startIso, endIso),
    getMRRSnapshot(companyId),
    getARRAdded(companyId, startIso, endIso),
    getPayrollSummary(companyId, startIso, endIso),
  ]);

  // Legacy "revenue" block — kept for backwards compatibility with the
  // existing Overview UI. Sourced from jobs.scheduled_at + status.
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
  const collectionRate =
    revenue.total > 0 ? revenue.collected / revenue.total : 0;

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

  const jobBreakdownRows = (await db
    .prepare(
      `SELECT recurring, status, price_cents
         FROM jobs
        WHERE company_id = ?
          AND scheduled_at >= ? AND scheduled_at < ?`
    )
    .all(companyId, startIso, endIso)) as {
    recurring: number | null;
    status: string | null;
    price_cents: number | null;
  }[];

  function jobBucket(rs: typeof jobBreakdownRows) {
    let count = 0;
    let expected = 0;
    let collectedSum = 0;
    for (const r of rs) {
      if (r.status === "cancelled") continue;
      const price = r.price_cents || 0;
      count += 1;
      expected += price;
      if (r.status === "completed") collectedSum += price;
    }
    return {
      count,
      expected_cents: expected,
      collected_cents: collectedSum,
      avg_value_cents: count > 0 ? Math.round(expected / count) : 0,
    };
  }

  const servicePlanJobs = jobBucket(
    jobBreakdownRows.filter((r) => r.recurring === 1)
  );
  const oneOffJobs = jobBucket(
    jobBreakdownRows.filter((r) => r.recurring !== 1)
  );

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

  // Active subscription counts for this period.
  const subTotals = (await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active
       FROM customer_subscriptions
       WHERE company_id = ?`
    )
    .get(companyId)) as { active: number };

  // ARPC: collected revenue / unique paying customers in range.
  const payingRow = (await db
    .prepare(
      `SELECT COUNT(DISTINCT j.customer_id) AS n
         FROM payments p
         JOIN jobs j ON j.id = p.job_id
        WHERE p.company_id = ?
          AND p.payment_date >= ? AND p.payment_date < ?`
    )
    .get(companyId, startIso, endIso)) as { n: number };
  const payingCustomers = payingRow?.n || 0;
  const arpcCents =
    payingCustomers > 0 ? Math.round(collected.total_cents / payingCustomers) : 0;

  return NextResponse.json({
    range,
    start: startIso,
    end: endIso,
    revenue: {
      total_cents: revenue.total,
      collected_cents: revenue.collected,
      unpaid_cents: revenue.unpaid,
      collection_rate: collectionRate,
    },
    company_revenue: {
      collected: collected,
      generated: generated,
    },
    profit: {
      total_revenue_cents: payroll.total_revenue_cents,
      total_payout_cents: payroll.total_payout_cents,
      net_profit_cents: payroll.net_profit_cents,
    },
    arpc: {
      paying_customers: payingCustomers,
      cents: arpcCents,
    },
    jobs: {
      total: jobs.total,
      completed: jobs.completed,
      scheduled: jobs.scheduled,
      cancelled: jobs.cancelled,
      avg_value_cents: Math.round(jobs.avg_value),
      service_plan: servicePlanJobs,
      one_off: oneOffJobs,
    },
    customers: {
      total: totalCustomers,
      new: newCustomers,
      repeat: repeatCustomers,
    },
    subscriptions: {
      active: subTotals.active,
      new: arrAdded.count_started,
      canceled: arrAdded.count_canceled,
      mrr_cents: mrrCents,
      arr_cents: mrrCents * 12,
      arr_added_cents: arrAdded.gross_added_cents,
      arr_added_gross_cents: arrAdded.gross_added_cents,
      arr_added_net_cents: arrAdded.net_added_cents,
      arr_churned_cents: arrAdded.churned_cents,
    },
  });
}
