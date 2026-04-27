import { NextResponse } from "next/server";
import { getDb, type Customer } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<Customer>;
  const existing = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(id) as Customer | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const first = (body.first_name ?? existing.first_name ?? "").trim();
  const last = (body.last_name ?? existing.last_name ?? "").trim();
  if (!first || !last) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }
  const name = buildName(first, last);
  db.prepare(
    `UPDATE customers
     SET name = ?, first_name = ?, last_name = ?, phone = ?, email = ?, address = ?, notes = ?
     WHERE id = ?`
  ).run(
    name,
    first,
    last,
    body.phone ?? existing.phone,
    body.email ?? existing.email,
    body.address ?? existing.address,
    body.notes ?? existing.notes,
    id
  );
  const updated = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(id) as Customer;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
