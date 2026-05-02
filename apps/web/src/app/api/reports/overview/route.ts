import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    },
    customers: {
      total: totalCustomers,
      new: newCustomers,
      repeat: repeatCustomers,
    },
  });
}
