import { NextResponse } from "next/server";
import { getDb, type Message } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const customerId = Number(url.searchParams.get("customer_id"));
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }
  const rows = db
    .prepare(
      "SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at ASC, id ASC"
    )
    .all(customerId) as Message[];
  // Mark inbound messages as read
  db.prepare(
    `UPDATE messages SET read_at = datetime('now')
     WHERE customer_id = ? AND direction = 'inbound' AND read_at IS NULL`
  ).run(customerId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
    body: string;
    direction: "outbound" | "inbound";
  }>;
  const customerId = Number(body.customer_id);
  const text = (body.body || "").trim();
  const direction = body.direction === "inbound" ? "inbound" : "outbound";
  if (!customerId || !text) {
    return NextResponse.json(
      { error: "customer_id and body are required" },
      { status: 400 }
    );
  }
  const result = db
    .prepare(
      `INSERT INTO messages (customer_id, body, direction)
       VALUES (?, ?, ?)`
    )
    .run(customerId, text, direction);
  const created = db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(result.lastInsertRowid) as Message;
  return NextResponse.json(created, { status: 201 });
}
