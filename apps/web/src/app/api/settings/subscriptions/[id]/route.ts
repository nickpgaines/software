import { NextResponse } from "next/server";
import { getDb, type SubscriptionTemplate } from "@/lib/db";
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
    .prepare("SELECT * FROM subscription_templates WHERE id = ?")
    .get(Number(params.id))) as SubscriptionTemplate | undefined;
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
    .prepare("SELECT * FROM subscription_templates WHERE id = ?")
    .get(id)) as SubscriptionTemplate | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    description: string | null;
    active: boolean | number;
    terms_id: number | null;
    require_signature: boolean | number;
    tax_rate_bps: number;
  }>;

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : existing.name;
  const description =
    body.description === undefined
      ? existing.description
      : body.description === null
        ? null
        : String(body.description).trim() || null;
  const active =
    body.active === undefined
      ? existing.active
      : body.active === false || body.active === 0
        ? 0
        : 1;
  const termsId =
    body.terms_id === undefined
      ? existing.terms_id
      : body.terms_id === null
        ? null
        : Number(body.terms_id) || null;
  const requireSignature =
    body.require_signature === undefined
      ? existing.require_signature
      : body.require_signature === true || body.require_signature === 1
        ? 1
        : 0;
  const taxRateBps =
    body.tax_rate_bps === undefined
      ? existing.tax_rate_bps
      : Math.max(0, Math.round(Number(body.tax_rate_bps) || 0));

  await db
    .prepare(
      `UPDATE subscription_templates
         SET name = ?, description = ?, active = ?,
             terms_id = ?, require_signature = ?, tax_rate_bps = ?,
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      name,
      description,
      active,
      termsId,
      requireSignature,
      taxRateBps,
      id
    );
  const row = (await db
    .prepare("SELECT * FROM subscription_templates WHERE id = ?")
    .get(id)) as SubscriptionTemplate;
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
    .prepare("DELETE FROM subscription_templates WHERE id = ?")
    .run(Number(params.id));
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
