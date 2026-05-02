import { NextResponse } from "next/server";
import { getDb, type LeadWorkflow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM lead_workflows WHERE id = ?")
    .get(id)) as LeadWorkflow | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<LeadWorkflow>;
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  if (typeof body.name === "string") {
    fields.push("name = ?");
    args.push(body.name.trim());
  }
  if (typeof body.trigger === "string") {
    fields.push("trigger = ?");
    args.push(body.trigger);
  }
  if (typeof body.max_per_day === "number") {
    fields.push("max_per_day = ?");
    args.push(body.max_per_day);
  }
  if (body.enabled !== undefined) {
    fields.push("enabled = ?");
    args.push(body.enabled ? 1 : 0);
  }
  if (typeof body.steps === "string") {
    fields.push("steps = ?");
    args.push(body.steps);
  }
  if (fields.length === 0) return NextResponse.json(existing);
  fields.push("updated_at = datetime('now')");
  args.push(id);
  await db
    .prepare(`UPDATE lead_workflows SET ${fields.join(", ")} WHERE id = ?`)
    .run(...args);
  const updated = (await db
    .prepare("SELECT * FROM lead_workflows WHERE id = ?")
    .get(id)) as LeadWorkflow;
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  await db
    .prepare("DELETE FROM lead_workflows WHERE id = ?")
    .run(Number(params.id));
  return NextResponse.json({ ok: true });
}
