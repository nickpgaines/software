import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM staff ORDER BY name COLLATE NOCASE ASC")
    .all() as Staff[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<Staff>;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const result = db
    .prepare("INSERT INTO staff (name, role) VALUES (?, ?)")
    .run(name, body.role || null);
  const created = db
    .prepare("SELECT * FROM staff WHERE id = ?")
    .get(result.lastInsertRowid) as Staff;
  return NextResponse.json(created, { status: 201 });
}
