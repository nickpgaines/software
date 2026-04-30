import { NextResponse } from "next/server";
import { getDb, type MapPin } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<{
    lat: number;
    lng: number;
    address: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    status: string;
    objections: string[] | null;
    notes: string | null;
    customer_id: number | null;
  }>;
  const existing = (await db
    .prepare("SELECT * FROM map_pins WHERE id = ?")
    .get(id)) as MapPin | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.prepare(
    `UPDATE map_pins
       SET lat = ?, lng = ?, address = ?, first_name = ?, last_name = ?,
           phone = ?, status = ?, objections = ?, notes = ?, customer_id = ?
     WHERE id = ?`
  ).run(
    body.lat ?? existing.lat,
    body.lng ?? existing.lng,
    body.address !== undefined ? body.address : existing.address,
    body.first_name !== undefined ? body.first_name : existing.first_name,
    body.last_name !== undefined ? body.last_name : existing.last_name,
    body.phone !== undefined ? body.phone : existing.phone,
    body.status ?? existing.status,
    body.objections !== undefined
      ? body.objections
        ? JSON.stringify(body.objections)
        : null
      : existing.objections,
    body.notes !== undefined ? body.notes : existing.notes,
    body.customer_id !== undefined ? body.customer_id : existing.customer_id,
    id
  );
  const updated = (await db
    .prepare("SELECT * FROM map_pins WHERE id = ?")
    .get(id)) as MapPin;
  return NextResponse.json(updated);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: string;
    note: string | null;
    notes: string | null;
  }>;
  const existing = (await db
    .prepare("SELECT * FROM map_pins WHERE id = ?")
    .get(id)) as MapPin | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const nextNotes =
    body.note !== undefined
      ? body.note
      : body.notes !== undefined
      ? body.notes
      : existing.notes;
  const nextStatus = body.status ?? existing.status;
  await db
    .prepare("UPDATE map_pins SET status = ?, notes = ? WHERE id = ?")
    .run(nextStatus, nextNotes, id);
  const updated = (await db
    .prepare("SELECT * FROM map_pins WHERE id = ?")
    .get(id)) as MapPin;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  await db.prepare("DELETE FROM map_pins WHERE id = ?").run(Number(params.id));
  return NextResponse.json({ ok: true });
}
