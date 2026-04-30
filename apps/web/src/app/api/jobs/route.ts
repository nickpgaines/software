import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeJobStatus, createJob, type JobInput } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type JobRow = {
  id: number;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  price_cents: number;
  paid_total_cents: number;
};

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let sql = `
    SELECT j.*,
           c.name AS customer_name,
           c.address AS customer_address,
           c.phone AS customer_phone,
           sp.name AS salesperson_name,
           tc.name AS technician_name,
           COALESCE(
             (SELECT SUM(amount_cents) FROM payments p WHERE p.job_id = j.id),
             0
           ) AS paid_total_cents
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    LEFT JOIN staff sp ON sp.id = j.salesperson_id
    LEFT JOIN staff tc ON tc.id = j.technician_id
  `;
  const where: string[] = [];
  const args: unknown[] = [];
  if (from) {
    where.push("j.scheduled_at >= ?");
    args.push(from);
  }
  if (to) {
    where.push("j.scheduled_at < ?");
    args.push(to);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY j.scheduled_at ASC";

  const rows = (await db
    .prepare(sql)
    .all(...(args as (string | number | null)[]))) as (JobRow &
    Record<string, unknown>)[];
  const enriched = rows.map((row) => ({
    ...row,
    job_status: computeJobStatus({
      en_route_at: row.en_route_at,
      arrived_at: row.arrived_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      price_cents: row.price_cents,
      paid_total_cents: row.paid_total_cents,
    }),
  }));
  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<JobInput>;
  if (!body.customer_id || !body.start_time) {
    return NextResponse.json(
      { error: "customer_id and start_time are required" },
      { status: 400 }
    );
  }
  const id = await createJob(db, body as JobInput);
  return NextResponse.json({ id }, { status: 201 });
}
