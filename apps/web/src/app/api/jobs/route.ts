import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createJob, type JobInput } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let sql = `
    SELECT j.*,
           c.name AS customer_name,
           c.address AS customer_address,
           c.phone AS customer_phone,
           sp.name AS salesperson_name,
           tc.name AS technician_name
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

  const rows = db.prepare(sql).all(...args);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<JobInput>;
  if (!body.customer_id || !body.start_time) {
    return NextResponse.json(
      { error: "customer_id and start_time are required" },
      { status: 400 }
    );
  }
  const id = createJob(db, body as JobInput);
  return NextResponse.json({ id }, { status: 201 });
}
