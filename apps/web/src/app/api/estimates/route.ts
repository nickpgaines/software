import { NextResponse } from "next/server";
import {
  getDb,
  type Estimate,
  type EstimateItem,
  type EstimateStatus,
} from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type IncomingItem = {
  title?: string;
  description?: string | null;
  quantity?: number | string;
  price_cents?: number | string;
};

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function toFloat(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeTotal(items: IncomingItem[]): number {
  let subtotal = 0;
  for (const it of items) {
    const qty = toFloat(it.quantity, 1);
    const price = toInt(it.price_cents, 0);
    subtotal += Math.max(0, Math.round(qty * price));
  }
  return subtotal;
}

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const db = await getDb();
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");

  let rows: Estimate[];
  if (customerId) {
    rows = (await db
      .prepare(
        `SELECT * FROM estimates WHERE customer_id = ? AND company_id = ? ORDER BY created_at DESC, id DESC`
      )
      .all(Number(customerId), companyId)) as Estimate[];
  } else {
    rows = (await db
      .prepare(
        `SELECT * FROM estimates WHERE company_id = ? ORDER BY created_at DESC, id DESC`
      )
      .all(companyId)) as Estimate[];
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = ctx.identity;
  const companyId = ctx.companyId;
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
    notes: string;
    lead_source: string;
    sold_by_id: number | null;
    items: IncomingItem[];
  }>;

  const customerId = Number(body.customer_id);
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }

  const customer = await db
    .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
    .get<{ id: number }>(customerId, companyId);
  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json(
      { error: "at least one line item is required" },
      { status: 400 }
    );
  }
  for (const it of items) {
    if (!it.title || !String(it.title).trim()) {
      return NextResponse.json(
        { error: "every line item needs a title" },
        { status: 400 }
      );
    }
  }

  const total = computeTotal(items);
  const status: EstimateStatus = "draft";
  const notes = body.notes?.toString().trim() || null;
  const leadSource = body.lead_source?.toString().trim() || null;
  const soldById =
    body.sold_by_id == null ? null : Number(body.sold_by_id) || null;

  const result = await db
    .prepare(
      `INSERT INTO estimates
         (company_id, customer_id, notes, status, total_cents, tax_rate_bps,
          created_by, lead_source, sold_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      customerId,
      notes,
      status,
      total,
      0,
      user,
      leadSource,
      soldById
    );
  const estimateId = result.lastInsertRowid;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await db
      .prepare(
        `INSERT INTO estimate_items
           (estimate_id, title, description, quantity, price_cents, taxable, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        estimateId,
        String(it.title).trim(),
        it.description ? String(it.description).trim() : null,
        toFloat(it.quantity, 1),
        toInt(it.price_cents, 0),
        0,
        i
      );
  }

  const estimate = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(estimateId, companyId)) as Estimate;
  const lineItems = (await db
    .prepare(
      "SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY position ASC, id ASC"
    )
    .all(estimateId)) as EstimateItem[];
  return NextResponse.json({ ...estimate, items: lineItems }, { status: 201 });
}
