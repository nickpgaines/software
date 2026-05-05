import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRangeFromUrl } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Bucket = {
  count: number;
  expected_cents: number;
  collected_cents: number;
  avg_value_cents: number;
};

type Row = {
  recurring: number | null;
  status: string | null;
  price_cents: number | null;
};

function bucket(rows: Row[]): Bucket {
  let count = 0;
  let expected = 0;
  let collected = 0;
  for (const r of rows) {
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

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRangeFromUrl(url);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const rows = (await db
    .prepare(
      `SELECT recurring, status, price_cents
         FROM jobs
        WHERE company_id = ?
          AND scheduled_at >= ? AND scheduled_at < ?`
    )
    .all(companyId, startIso, endIso)) as Row[];

  const servicePlan = bucket(rows.filter((r) => r.recurring === 1));
  const oneOff = bucket(rows.filter((r) => r.recurring !== 1));
  const all = bucket(rows);

  // True cash collected from payments table.
  const cashRow = (await db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents + tip_cents), 0) AS total
         FROM payments
        WHERE company_id = ?
          AND payment_date >= ? AND payment_date < ?`
    )
    .get<{ total: number }>(companyId, startIso, endIso)) || { total: 0 };

  // Cash collection lag: avg days between job completion and the first
  // payment_date for that job, for completed jobs in the range.
  const lagRows = (await db
    .prepare(
      `SELECT j.completed_at AS completed_at,
              MIN(p.payment_date) AS first_paid_at
         FROM jobs j
         JOIN payments p ON p.job_id = j.id
        WHERE j.company_id = ?
          AND j.status = 'completed'
          AND j.completed_at IS NOT NULL
          AND j.completed_at >= ? AND j.completed_at < ?
        GROUP BY j.id`
    )
    .all<{ completed_at: string; first_paid_at: string }>(
      companyId,
      startIso,
      endIso,
    )) || [];

  let lagSumMs = 0;
  let lagN = 0;
  for (const r of lagRows) {
    if (!r.completed_at || !r.first_paid_at) continue;
    const ms =
      new Date(r.first_paid_at).getTime() -
      new Date(r.completed_at).getTime();
    if (Number.isFinite(ms) && ms >= 0) {
      lagSumMs += ms;
      lagN += 1;
    }
  }
  const avgLagDays = lagN > 0 ? lagSumMs / lagN / 86400000 : 0;

  // First-time vs repeat customer revenue split (within range).
  // A job is "first-time" if the customer has no prior completed jobs before
  // the start of the range; otherwise "repeat".
  const splitRows = (await db
    .prepare(
      `SELECT j.customer_id AS customer_id,
              j.price_cents AS price_cents,
              (SELECT COUNT(*) FROM jobs j2
                 WHERE j2.customer_id = j.customer_id
                   AND j2.company_id = ?
                   AND j2.status = 'completed'
                   AND j2.scheduled_at < ?) AS prior_count
         FROM jobs j
        WHERE j.company_id = ?
          AND j.status = 'completed'
          AND j.scheduled_at >= ? AND j.scheduled_at < ?`
    )
    .all<{ customer_id: number; price_cents: number; prior_count: number }>(
      companyId,
      startIso,
      companyId,
      startIso,
      endIso,
    )) || [];

  let firstTimeRevenue = 0;
  let repeatRevenue = 0;
  for (const r of splitRows) {
    const v = r.price_cents || 0;
    if ((r.prior_count || 0) === 0) firstTimeRevenue += v;
    else repeatRevenue += v;
  }

  return NextResponse.json({
    range,
    start: startIso,
    end: endIso,
    service_plan: servicePlan,
    one_off: oneOff,
    all,
    cash_collected_cents: cashRow.total,
    avg_collection_lag_days: avgLagDays,
    customer_split: {
      first_time_cents: firstTimeRevenue,
      repeat_cents: repeatRevenue,
    },
  });
}
