import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM customers ORDER BY first_name COLLATE NOCASE ASC, last_name COLLATE NOCASE ASC"
    )
    .all() as Customer[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<Customer>;
  const first = (body.first_name || "").trim();
  const last = (body.last_name || "").trim();
  if (!first || !last) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }
  const name = buildName(first, last);
  const stmt = db.prepare(
    `INSERT INTO customers (name, first_name, last_name, phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    name,
    first,
    last,
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
