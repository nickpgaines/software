import { NextResponse } from "next/server";
import { getDb, type LeadWorkflow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare("SELECT * FROM lead_workflows ORDER BY id ASC")
    .all()) as LeadWorkflow[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<LeadWorkflow>;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await db
    .prepare(
      `INSERT INTO lead_workflows (name, trigger, max_per_day, enabled, steps)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      name,
      body.trigger || "lead_created",
      body.max_per_day ?? 3,
      body.enabled ? 1 : 0,
      typeof body.steps === "string" ? body.steps : "[]"
    );
  const created = (await db
    .prepare("SELECT * FROM lead_workflows WHERE id = ?")
    .get(result.lastInsertRowid)) as LeadWorkflow;
  return NextResponse.json(created, { status: 201 });
}
