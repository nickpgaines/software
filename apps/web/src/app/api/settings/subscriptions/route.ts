import { NextResponse } from "next/server";
import { getDb, type SubscriptionTemplate } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM subscription_templates ORDER BY active DESC, name ASC, id ASC"
    )
    .all()) as SubscriptionTemplate[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    description: string;
    active: boolean | number;
    terms_id: number | null;
    require_signature: boolean | number;
    tax_rate_bps: number;
  }>;

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const description = body.description?.trim() || null;
  const active = body.active === false || body.active === 0 ? 0 : 1;
  const termsId =
    body.terms_id === null || body.terms_id === undefined
      ? null
      : Number(body.terms_id) || null;
  const requireSignature =
    body.require_signature === true || body.require_signature === 1 ? 1 : 0;
  const taxRateBps = Math.max(0, Math.round(Number(body.tax_rate_bps) || 0));

  // price_cents and interval are kept on the table for backward compatibility
  // but no longer stored on templates — they're set per-customer when a
  // subscription is created. We insert defaults so existing column constraints
  // are satisfied.
  const result = await db
    .prepare(
      `INSERT INTO subscription_templates
         (name, description, price_cents, interval, active, terms_id, require_signature, tax_rate_bps)
       VALUES (?, ?, 0, 'monthly', ?, ?, ?, ?)`
    )
    .run(name, description, active, termsId, requireSignature, taxRateBps);
  const row = (await db
    .prepare("SELECT * FROM subscription_templates WHERE id = ?")
    .get(result.lastInsertRowid)) as SubscriptionTemplate;
  return NextResponse.json(row, { status: 201 });
}
