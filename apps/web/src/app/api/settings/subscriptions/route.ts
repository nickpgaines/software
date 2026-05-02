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

function normalizeInterval(v: unknown): SubscriptionInterval {
  return VALID_INTERVALS.includes(v as SubscriptionInterval)
    ? (v as SubscriptionInterval)
    : "monthly";
}

function toCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

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
    price_cents: number;
    interval: SubscriptionInterval;
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
  const price_cents = Math.max(0, toCents(body.price_cents));
  const interval = normalizeInterval(body.interval);
  const active =
    body.active === false || body.active === 0 ? 0 : 1;
  const termsId =
    body.terms_id === null || body.terms_id === undefined
      ? null
      : Number(body.terms_id) || null;
  const requireSignature =
    body.require_signature === true || body.require_signature === 1 ? 1 : 0;
  const taxRateBps = Math.max(0, Math.round(Number(body.tax_rate_bps) || 0));

  const result = await db
    .prepare(
      `INSERT INTO subscription_templates
         (name, description, price_cents, interval, active, terms_id, require_signature, tax_rate_bps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      description,
      price_cents,
      interval,
      active,
      termsId,
      requireSignature,
      taxRateBps
    );
  const row = (await db
    .prepare("SELECT * FROM subscription_templates WHERE id = ?")
    .get(result.lastInsertRowid)) as SubscriptionTemplate;
  return NextResponse.json(row, { status: 201 });
}
