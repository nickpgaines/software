import { NextResponse } from "next/server";
import { getDb, type Lead } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAGE_TIMESTAMP: Record<string, string | null> = {
  new: null,
  contacted: "contacted_at",
  responded: "responded_at",
  estimate_sent: "estimate_sent_at",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const row = (await db
    .prepare("SELECT * FROM leads WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Lead | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM leads WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Lead | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<Lead>;
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  const editable: (keyof Lead)[] = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "stage",
    "notes",
    "position",
  ];
  for (const key of editable) {
    if (key in body) {
      fields.push(`${key} = ?`);
      args.push((body[key] as string | number | null) ?? null);
    }
  }
  if (body.stage && body.stage !== existing.stage) {
    const tsCol = STAGE_TIMESTAMP[body.stage];
    if (tsCol) {
      fields.push(`${tsCol} = COALESCE(${tsCol}, datetime('now'))`);
    }
  }
  if (fields.length === 0) {
    return NextResponse.json(existing);
  }
  fields.push("updated_at = datetime('now')");
  args.push(id);
  args.push(companyId);
  await db
    .prepare(
      `UPDATE leads SET ${fields.join(", ")} WHERE id = ? AND company_id = ?`
    )
    .run(...args);
  const updated = (await db
    .prepare("SELECT * FROM leads WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Lead;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM leads WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return NextResponse.json({ ok: true });
}
