import { NextResponse } from "next/server";
import { getDb, type LeadForm } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM lead_forms WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as LeadForm | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<LeadForm>;
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  if (typeof body.name === "string") {
    fields.push("name = ?");
    args.push(body.name.trim());
  }
  if (typeof body.fields === "string") {
    fields.push("fields = ?");
    args.push(body.fields);
  }
  if (body.enabled !== undefined) {
    fields.push("enabled = ?");
    args.push(body.enabled ? 1 : 0);
  }
  if (fields.length === 0) return NextResponse.json(existing);
  fields.push("updated_at = datetime('now')");
  args.push(id);
  args.push(companyId);
  await db
    .prepare(
      `UPDATE lead_forms SET ${fields.join(", ")} WHERE id = ? AND company_id = ?`
    )
    .run(...args);
  const updated = (await db
    .prepare("SELECT * FROM lead_forms WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as LeadForm;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  await db
    .prepare("DELETE FROM lead_forms WHERE id = ? AND company_id = ?")
    .run(Number(params.id), companyId);
  return NextResponse.json({ ok: true });
}
