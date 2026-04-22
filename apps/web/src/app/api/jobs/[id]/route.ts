import { NextResponse } from "next/server";
import { getDb, type Job } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<Job>;
  const existing = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | Job
    | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  db.prepare(
    `UPDATE jobs
     SET customer_id = ?, scheduled_at = ?, duration_minutes = ?, price_cents = ?,
         status = ?, notes = ?, salesperson_id = ?, technician_id = ?
     WHERE id = ?`
  ).run(
    body.customer_id ?? existing.customer_id,
    body.scheduled_at ?? existing.scheduled_at,
    body.duration_minutes ?? existing.duration_minutes,
    body.price_cents ?? existing.price_cents,
    body.status ?? existing.status,
    body.notes ?? existing.notes,
    body.salesperson_id === undefined ? existing.salesperson_id : body.salesperson_id,
    body.technician_id === undefined ? existing.technician_id : body.technician_id,
    id
  );
  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
