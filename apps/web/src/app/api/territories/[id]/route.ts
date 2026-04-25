import { NextResponse } from "next/server";
import { getDb, type Territory } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    color: string;
    polygon: number[][];
    assigned_employee_ids: number[];
  }>;
  const existing = db
    .prepare("SELECT * FROM territories WHERE id = ?")
    .get(id) as Territory | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  db.prepare(
    `UPDATE territories
       SET name = ?, color = ?, polygon = ?, assigned_employee_ids = ?
     WHERE id = ?`
  ).run(
    body.name ?? existing.name,
    body.color ?? existing.color,
    body.polygon ? JSON.stringify(body.polygon) : existing.polygon,
    body.assigned_employee_ids !== undefined
      ? body.assigned_employee_ids
        ? JSON.stringify(body.assigned_employee_ids)
        : null
      : existing.assigned_employee_ids,
    id
  );
  const updated = db
    .prepare("SELECT * FROM territories WHERE id = ?")
    .get(id) as Territory;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  db.prepare("DELETE FROM territories WHERE id = ?").run(Number(params.id));
  return NextResponse.json({ ok: true });
}
