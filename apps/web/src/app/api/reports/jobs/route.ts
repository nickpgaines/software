import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
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
  const { range, start, end } = resolveReportRange(url.searchParams.get("range"));
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

  return NextResponse.json({
    range,
    start: startIso,
    end: endIso,
    service_plan: servicePlan,
    one_off: oneOff,
    all,
  });
}
