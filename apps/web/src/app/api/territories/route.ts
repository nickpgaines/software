import { NextResponse } from "next/server";
import { getDb, type Territory } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM territories WHERE company_id = ? ORDER BY created_at DESC"
    )
    .all(ctx.companyId)) as Territory[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    color: string;
    polygon: number[][];
    assigned_employee_ids: number[];
  }>;
  if (!body.name || !body.polygon || body.polygon.length < 3) {
    return NextResponse.json(
      { error: "name and polygon (>=3 points) required" },
      { status: 400 }
    );
  }
  const result = await db
    .prepare(
      `INSERT INTO territories (company_id, name, color, polygon, assigned_employee_ids, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      ctx.companyId,
      body.name,
      body.color || "#3b82f6",
      JSON.stringify(body.polygon),
      body.assigned_employee_ids
        ? JSON.stringify(body.assigned_employee_ids)
        : null,
      ctx.identity
    );
  const created = (await db
    .prepare("SELECT * FROM territories WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, ctx.companyId)) as Territory;
  return NextResponse.json(created, { status: 201 });
}
