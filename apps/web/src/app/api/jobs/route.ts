import { NextResponse } from "next/server";
import { getDb, type Job, type JobWithCustomer } from "@/lib/db";

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

  const rows = db.prepare(sql).all(...args) as JobWithCustomer[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<Job>;
  const customerId = Number(body.customer_id);
  const scheduledAt = (body.scheduled_at || "").trim();
  if (!customerId || !scheduledAt) {
    return NextResponse.json(
      { error: "customer_id and scheduled_at are required" },
      { status: 400 }
    );
  }
  const stmt = db.prepare(
    `INSERT INTO jobs
       (customer_id, scheduled_at, duration_minutes, price_cents, status, notes, salesperson_id, technician_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    customerId,
    scheduledAt,
    body.duration_minutes ?? 60,
    body.price_cents ?? 0,
    body.status || "scheduled",
    body.notes || null,
    body.salesperson_id ?? null,
    body.technician_id ?? null
  );
  const created = db
    .prepare("SELECT * FROM jobs WHERE id = ?")
    .get(result.lastInsertRowid) as Job;
  return NextResponse.json(created, { status: 201 });
}
