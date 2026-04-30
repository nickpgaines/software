import { NextResponse } from "next/server";
import { getDb, type SubscriptionTerms } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM subscription_terms ORDER BY name COLLATE NOCASE ASC, id ASC"
    )
    .all()) as SubscriptionTerms[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    body: string;
  }>;
  const name = (body.name || "").trim();
  const text = (body.body || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const result = await db
    .prepare(
      `INSERT INTO subscription_terms (name, body) VALUES (?, ?)`
    )
    .run(name, text);
  const row = (await db
    .prepare("SELECT * FROM subscription_terms WHERE id = ?")
    .get(result.lastInsertRowid)) as SubscriptionTerms;
  return NextResponse.json(row, { status: 201 });
}
