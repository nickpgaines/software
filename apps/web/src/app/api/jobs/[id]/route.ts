import { NextResponse } from "next/server";
import db, { type Job } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
     SET customer_id = ?, scheduled_at = ?, duration_minutes = ?, price_cents = ?, status = ?, notes = ?
     WHERE id = ?`
  ).run(
    body.customer_id ?? existing.customer_id,
    body.scheduled_at ?? existing.scheduled_at,
    body.duration_minutes ?? existing.duration_minutes,
    body.price_cents ?? existing.price_cents,
    body.status ?? existing.status,
    body.notes ?? existing.notes,
    id
  );
  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
