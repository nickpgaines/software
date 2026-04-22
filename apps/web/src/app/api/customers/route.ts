import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC")
    .all() as Customer[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<Customer>;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const stmt = db.prepare(
    `INSERT INTO customers (name, phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    name,
    body.phone || null,
    body.email || null,
    body.address || null,
    body.notes || null
  );
  const created = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(result.lastInsertRowid) as Customer;
  return NextResponse.json(created, { status: 201 });
}
