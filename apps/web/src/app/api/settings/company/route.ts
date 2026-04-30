import { NextResponse } from "next/server";
import { getDb, type Company } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const row = (await db.prepare("SELECT * FROM company WHERE id = 1").get()) as
    | Company
    | undefined;
  return NextResponse.json(
    row ?? { id: 1, name: null, address: null, phone: null, updated_at: "" }
  );
}

export async function PUT(req: Request) {
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    address: string;
    phone: string;
  }>;
  await db.prepare(
    `UPDATE company
       SET name = ?, address = ?, phone = ?, updated_at = datetime('now')
     WHERE id = 1`
  ).run(body.name || null, body.address || null, body.phone || null);
  const row = (await db.prepare("SELECT * FROM company WHERE id = 1").get()) as Company;
  return NextResponse.json(row);
}
