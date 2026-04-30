import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  last_body: string | null;
  last_direction: string | null;
  last_at: string | null;
  unread_count: number;
};

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT
         c.id, c.name, c.phone, c.email,
         (SELECT body FROM messages m WHERE m.customer_id = c.id
           ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_body,
         (SELECT direction FROM messages m WHERE m.customer_id = c.id
           ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_direction,
         (SELECT created_at FROM messages m WHERE m.customer_id = c.id
           ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at,
         (SELECT COUNT(*) FROM messages m WHERE m.customer_id = c.id
           AND m.direction = 'inbound' AND m.read_at IS NULL) AS unread_count
       FROM customers c
       ORDER BY
         (last_at IS NULL),
         last_at DESC,
         c.name COLLATE NOCASE ASC`
    )
    .all()) as Row[];
  return NextResponse.json(rows);
}
