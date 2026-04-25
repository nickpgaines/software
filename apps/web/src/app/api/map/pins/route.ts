import { NextResponse } from "next/server";
import { getDb, type MapPin } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

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
  notes?: string | null;
  customer_id?: number | null;
};

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const createdBy = url.searchParams.get("created_by");

  let sql = "SELECT * FROM map_pins";
  const where: string[] = [];
  const args: unknown[] = [];
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
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY created_at DESC";
  const rows = db.prepare(sql).all(...args) as MapPin[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Input;
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 }
    );
  }
  const result = db
    .prepare(
      `INSERT INTO map_pins
        (lat, lng, address, first_name, last_name, phone, status, objections,
         notes, customer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.lat,
      body.lng,
      body.address || null,
      body.first_name || null,
      body.last_name || null,
      body.phone || null,
      body.status || "not_home",
      body.objections ? JSON.stringify(body.objections) : null,
      body.notes || null,
      body.customer_id || null,
      getSessionUser() || null
    );
  const created = db
    .prepare("SELECT * FROM map_pins WHERE id = ?")
    .get(result.lastInsertRowid) as MapPin;
  return NextResponse.json(created, { status: 201 });
}
