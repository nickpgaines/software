import { NextResponse } from "next/server";
import { getDb, type SubscriptionTerms } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM subscription_terms WHERE id = ?")
    .get(Number(params.id))) as SubscriptionTerms | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM subscription_terms WHERE id = ?")
    .get(id)) as SubscriptionTerms | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    body: string;
  }>;
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : existing.name;
  const text =
    typeof body.body === "string" && body.body.trim()
      ? body.body.trim()
      : existing.body;
  await db
    .prepare(
      `UPDATE subscription_terms
         SET name = ?, body = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(name, text, id);
  const row = (await db
    .prepare("SELECT * FROM subscription_terms WHERE id = ?")
    .get(id)) as SubscriptionTerms;
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await db
    .prepare("DELETE FROM subscription_terms WHERE id = ?")
    .run(Number(params.id));
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
