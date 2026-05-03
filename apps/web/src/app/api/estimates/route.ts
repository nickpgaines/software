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
  taxable?: boolean | number;
};

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function toFloat(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bps(rate: unknown): number {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function computeTotal(
  items: IncomingItem[],
  taxRateBps: number
): number {
  let subtotal = 0;
  let taxable = 0;
  for (const it of items) {
    const qty = toFloat(it.quantity, 1);
    const price = toInt(it.price_cents, 0);
    const line = Math.max(0, Math.round(qty * price));
    subtotal += line;
    if (it.taxable === true || it.taxable === 1) taxable += line;
  }
  const tax = Math.round((taxable * taxRateBps) / 10000);
  return subtotal + tax;
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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
    title: string;
    notes: string;
    items: IncomingItem[];
    tax_rate: number; // percent, e.g. 8.5
    valid_until: string;
    sold_by_id: number | null;
    action: "draft" | "send" | "accept";
    signature_data: string;
    signature_name: string;
  }>;

  const customerId = Number(body.customer_id);
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }

  const customer = await db
    .prepare("SELECT id, name FROM customers WHERE id = ? AND company_id = ?")
    .get<{ id: number; name: string }>(customerId, companyId);
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

  const action = body.action === "send" || body.action === "accept"
    ? body.action
    : "draft";

  const taxRateBps = bps(body.tax_rate ?? 0);
  const total = computeTotal(items, taxRateBps);
  const now = new Date().toISOString();
  const status: EstimateStatus =
    action === "accept" ? "accepted" : action === "send" ? "sent" : "draft";
  const sentAt = action === "send" || action === "accept" ? now : null;
  const acceptedAt = action === "accept" ? now : null;
  const signatureData =
    action === "accept" &&
    typeof body.signature_data === "string" &&
    body.signature_data.trim()
      ? body.signature_data.trim()
      : null;
  const signatureName =
    action === "accept" &&
    typeof body.signature_name === "string" &&
    body.signature_name.trim()
      ? body.signature_name.trim()
      : null;
  const signedAt = signatureData ? now : null;
  const validUntil =
    typeof body.valid_until === "string" && body.valid_until.trim()
      ? body.valid_until.trim()
      : null;
  const soldById =
    body.sold_by_id === undefined || body.sold_by_id === null
      ? null
      : Number(body.sold_by_id) || null;
  const title = body.title?.toString().trim() || null;
  const notes = body.notes?.toString().trim() || null;

  const result = await db
    .prepare(
      `INSERT INTO estimates
         (company_id, customer_id, title, notes, status, total_cents, tax_rate_bps,
          valid_until, sent_at, accepted_at,
          signature_data, signature_name, signed_at,
          sold_by_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      customerId,
      title,
      notes,
      status,
      total,
      taxRateBps,
      validUntil,
      sentAt,
      acceptedAt,
      signatureData,
      signatureName,
      signedAt,
      soldById,
      user
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
        it.taxable === true || it.taxable === 1 ? 1 : 0,
        i
      );
  }

  if (action === "send") {
    const titleLine = title ? `${title}\n` : "";
    const messageBody =
      `Hi ${customer.name}! Here's your estimate:\n` +
      `${titleLine}Total: ${formatPrice(total)}` +
      (validUntil ? `\nValid until ${validUntil}` : "") +
      `\nReply YES to accept.`;
    await db
      .prepare(
        `INSERT INTO messages (company_id, customer_id, body, direction)
         VALUES (?, ?, ?, 'outbound')`
      )
      .run(companyId, customerId, messageBody);
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
