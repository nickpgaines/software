import { NextResponse } from "next/server";
import { getDb, type LeadForm } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM lead_forms WHERE id = ?")
    .get(id)) as LeadForm | undefined;
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
  await db
    .prepare(`UPDATE lead_forms SET ${fields.join(", ")} WHERE id = ?`)
    .run(...args);
  const updated = (await db
    .prepare("SELECT * FROM lead_forms WHERE id = ?")
    .get(id)) as LeadForm;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  await db
    .prepare("DELETE FROM lead_forms WHERE id = ?")
    .run(Number(params.id));
  return NextResponse.json({ ok: true });
}
