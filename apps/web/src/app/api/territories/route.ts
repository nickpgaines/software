import { NextResponse } from "next/server";
import { getDb, type Territory } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare("SELECT * FROM territories ORDER BY created_at DESC")
    .all()) as Territory[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
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
      `INSERT INTO territories (name, color, polygon, assigned_employee_ids, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      body.name,
      body.color || "#3b82f6",
      JSON.stringify(body.polygon),
      body.assigned_employee_ids
        ? JSON.stringify(body.assigned_employee_ids)
        : null,
      getSessionUser() || null
    );
  const created = (await db
    .prepare("SELECT * FROM territories WHERE id = ?")
    .get(result.lastInsertRowid)) as Territory;
  return NextResponse.json(created, { status: 201 });
}
