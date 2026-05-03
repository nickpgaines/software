import { NextResponse } from "next/server";
import { getDb, type Territory } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    color: string;
    polygon: number[][];
    assigned_employee_ids: number[];
  }>;
  const existing = (await db
    .prepare("SELECT * FROM territories WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Territory | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.prepare(
    `UPDATE territories
       SET name = ?, color = ?, polygon = ?, assigned_employee_ids = ?
     WHERE id = ? AND company_id = ?`
  ).run(
    body.name ?? existing.name,
    body.color ?? existing.color,
    body.polygon ? JSON.stringify(body.polygon) : existing.polygon,
    body.assigned_employee_ids !== undefined
      ? body.assigned_employee_ids
        ? JSON.stringify(body.assigned_employee_ids)
        : null
      : existing.assigned_employee_ids,
    id,
    companyId
  );
  const updated = (await db
    .prepare("SELECT * FROM territories WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Territory;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  await db
    .prepare("DELETE FROM territories WHERE id = ? AND company_id = ?")
    .run(Number(params.id), companyId);
  return NextResponse.json({ ok: true });
}
