import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<Staff>;
  const existing = db.prepare("SELECT * FROM staff WHERE id = ?").get(id) as
    | Staff
    | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const name = (body.name ?? existing.name).trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  db.prepare("UPDATE staff SET name = ? WHERE id = ?").run(name, id);
  const updated = db.prepare("SELECT * FROM staff WHERE id = ?").get(id) as Staff;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  db.prepare("DELETE FROM staff WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
