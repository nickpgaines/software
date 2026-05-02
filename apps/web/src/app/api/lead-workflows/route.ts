import { NextResponse } from "next/server";
import { getDb, type LeadWorkflow } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM lead_workflows WHERE company_id = ? ORDER BY id ASC"
    )
    .all(companyId)) as LeadWorkflow[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<LeadWorkflow>;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await db
    .prepare(
      `INSERT INTO lead_workflows (company_id, name, trigger, max_per_day, enabled, steps)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      name,
      body.trigger || "lead_created",
      body.max_per_day ?? 3,
      body.enabled ? 1 : 0,
      typeof body.steps === "string" ? body.steps : "[]"
    );
  const created = (await db
    .prepare(
      "SELECT * FROM lead_workflows WHERE id = ? AND company_id = ?"
    )
    .get(result.lastInsertRowid, companyId)) as LeadWorkflow;
  return NextResponse.json(created, { status: 201 });
}
