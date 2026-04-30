import { NextResponse } from "next/server";
import {
  getDb,
  type SubscriptionInterval,
  type SubscriptionTemplate,
} from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_INTERVALS: SubscriptionInterval[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
];

function toCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

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
    price_cents: number;
    interval: SubscriptionInterval;
    active: boolean | number;
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
  const price_cents =
    body.price_cents === undefined
      ? existing.price_cents
      : Math.max(0, toCents(body.price_cents));
  const interval =
    body.interval && VALID_INTERVALS.includes(body.interval)
      ? body.interval
      : existing.interval;
  const active =
    body.active === undefined
      ? existing.active
      : body.active === false || body.active === 0
        ? 0
        : 1;

  await db
    .prepare(
      `UPDATE subscription_templates
         SET name = ?, description = ?, price_cents = ?, interval = ?, active = ?,
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(name, description, price_cents, interval, active, id);
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
