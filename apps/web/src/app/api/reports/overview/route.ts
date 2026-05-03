import { NextResponse } from "next/server";
import {
  getDb,
  type CustomerSubscription,
  type SubscriptionInterval,
} from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const INTERVALS_PER_YEAR: Record<SubscriptionInterval, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  triannually: 3,
  semiannually: 2,
  yearly: 1,
};

function monthlyCents(price_cents: number, interval: SubscriptionInterval) {
  return (price_cents * INTERVALS_PER_YEAR[interval]) / 12;
}

function withTax(cents: number, taxBps: number) {
  if (!taxBps) return cents;
  return cents * (1 + taxBps / 10000);
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRange(url.searchParams.get("range"));
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
    let collected = 0;
    for (const r of rs) {
      if (r.status === "cancelled") continue;
      const price = r.price_cents || 0;
      count += 1;
      expected += price;
      if (r.status === "completed") collected += price;
    }
    return {
      count,
      expected_cents: expected,
      collected_cents: collected,
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

  const subRows = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions WHERE company_id = ?`
    )
    .all(companyId)) as CustomerSubscription[];

  let mrrCents = 0;
  let activeSubs = 0;
  let newSubs = 0;
  let canceledSubs = 0;
  for (const r of subRows) {
    if (r.status === "active") {
      activeSubs += 1;
      mrrCents += withTax(
        monthlyCents(r.price_cents, r.interval),
        r.tax_rate_bps
      );
    }
    const start = r.start_date || r.accepted_at || r.created_at;
    if (
      start &&
      start >= startIso &&
      start < endIso &&
      r.status !== "declined" &&
      r.status !== "pending"
    ) {
      newSubs += 1;
    }
    if (
      r.canceled_at &&
      r.canceled_at >= startIso &&
      r.canceled_at < endIso
    ) {
      canceledSubs += 1;
    }
  }
  const mrrCentsRounded = Math.round(mrrCents);

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
      active: activeSubs,
      new: newSubs,
      canceled: canceledSubs,
      mrr_cents: mrrCentsRounded,
      arr_cents: mrrCentsRounded * 12,
    },
  });
}
