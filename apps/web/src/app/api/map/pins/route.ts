import { NextResponse } from "next/server";
import { getDb, type MapPin } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Input = {
  lat?: number;
  lng?: number;
  address?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status?: string;
  objections?: string[] | null;
  note?: string | null;
  notes?: string | null;
  customer_id?: number | null;
};

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const db = await getDb();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const createdBy = url.searchParams.get("created_by");

  const where: string[] = ["company_id = ?"];
  const args: unknown[] = [companyId];
  if (from) {
    where.push("created_at >= ?");
    args.push(from);
  }
  if (to) {
    where.push("created_at <= ?");
    args.push(to);
  }
  if (status) {
    const list = status.split(",").filter(Boolean);
    if (list.length > 0) {
      where.push(`status IN (${list.map(() => "?").join(",")})`);
      args.push(...list);
    }
  }
  if (createdBy) {
    where.push("created_by = ?");
    args.push(createdBy);
  }
  const sql = `SELECT * FROM map_pins WHERE ${where.join(" AND ")} ORDER BY created_at DESC`;
  const rows = (await db
    .prepare(sql)
    .all(...(args as (string | number | null)[]))) as MapPin[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Input;
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 }
    );
  }
  // Validate customer_id belongs to this tenant if provided.
  let safeCustomerId: number | null = null;
  if (body.customer_id) {
    const cust = await db
      .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
      .get<{ id: number }>(body.customer_id, companyId);
    if (cust) safeCustomerId = body.customer_id;
  }
  const result = await db
    .prepare(
      `INSERT INTO map_pins
        (company_id, lat, lng, address, first_name, last_name, phone, status, objections,
         notes, customer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      body.lat,
      body.lng,
      body.address || null,
      body.first_name || null,
      body.last_name || null,
      body.phone || null,
      body.status || "not_home",
      body.objections ? JSON.stringify(body.objections) : null,
      (body.note ?? body.notes) || null,
      safeCustomerId,
      ctx.identity
    );
  const created = (await db
    .prepare("SELECT * FROM map_pins WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, companyId)) as MapPin;
  return NextResponse.json(created, { status: 201 });
}
