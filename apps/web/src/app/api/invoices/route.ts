import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  getDb,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
} from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  getCompany,
  isStripeConfigured,
  getAppOrigin,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

function makePayToken() {
  return randomBytes(24).toString("base64url");
}

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

function computeTotal(items: IncomingItem[], taxRateBps: number): number {
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
  if (!getSessionUser()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");

  let rows: Invoice[];
  if (customerId) {
    rows = (await db
      .prepare(
        `SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC, id DESC`
      )
      .all(Number(customerId))) as Invoice[];
  } else {
    rows = (await db
      .prepare(
        `SELECT * FROM invoices ORDER BY created_at DESC, id DESC`
      )
      .all()) as Invoice[];
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
    job_id: number | null;
    title: string;
    notes: string;
    items: IncomingItem[];
    tax_rate: number;
    due_date: string;
    sold_by_id: number | null;
    action: "draft" | "send" | "paid";
  }>;

  const customerId = Number(body.customer_id);
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }

  const customer = await db
    .prepare("SELECT id, name FROM customers WHERE id = ?")
    .get<{ id: number; name: string }>(customerId);
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

  const action =
    body.action === "send" || body.action === "paid" ? body.action : "draft";

  const taxRateBps = bps(body.tax_rate ?? 0);
  const total = computeTotal(items, taxRateBps);
  const now = new Date().toISOString();
  const status: InvoiceStatus =
    action === "paid" ? "paid" : action === "send" ? "sent" : "draft";
  const sentAt = action === "send" || action === "paid" ? now : null;
  const paidAt = action === "paid" ? now : null;
  const paidCents = action === "paid" ? total : 0;
  const dueDate =
    typeof body.due_date === "string" && body.due_date.trim()
      ? body.due_date.trim()
      : null;
  const soldById =
    body.sold_by_id === undefined || body.sold_by_id === null
      ? null
      : Number(body.sold_by_id) || null;
  const jobId =
    body.job_id === undefined || body.job_id === null
      ? null
      : Number(body.job_id) || null;
  const title = body.title?.toString().trim() || null;
  const notes = body.notes?.toString().trim() || null;

  // If we're sending and the merchant has Stripe connected, mint a
  // pay-token now so we can include the pay URL in the message body.
  let payToken: string | null = null;
  let payUrl: string | null = null;
  if (action === "send" && isStripeConfigured()) {
    try {
      const company = await getCompany();
      if (company.stripe_account_id && company.stripe_charges_enabled) {
        payToken = makePayToken();
        payUrl = `${getAppOrigin(req)}/invoices/pay/${payToken}`;
      }
    } catch (e) {
      // If anything goes wrong reading company state, fall back to
      // sending the invoice without a pay link.
      console.error("Skipping pay link: failed to read Stripe company state", e);
    }
  }

  const result = await db
    .prepare(
      `INSERT INTO invoices
         (customer_id, job_id, title, notes, status,
          total_cents, paid_cents, tax_rate_bps,
          due_date, sent_at, paid_at,
          sold_by_id, created_by, stripe_pay_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      customerId,
      jobId,
      title,
      notes,
      status,
      total,
      paidCents,
      taxRateBps,
      dueDate,
      sentAt,
      paidAt,
      soldById,
      user,
      payToken
    );
  const invoiceId = result.lastInsertRowid;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await db
      .prepare(
        `INSERT INTO invoice_items
           (invoice_id, title, description, quantity, price_cents, taxable, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        invoiceId,
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
    const payLine = payUrl ? `\nPay online: ${payUrl}` : "";
    const messageBody =
      `Hi ${customer.name}! Here's your invoice:\n` +
      `${titleLine}Amount due: ${formatPrice(total)}` +
      (dueDate ? `\nDue ${dueDate}` : "") +
      payLine +
      `\nReply with any questions.`;
    await db
      .prepare(
        `INSERT INTO messages (customer_id, body, direction)
         VALUES (?, ?, 'outbound')`
      )
      .run(customerId, messageBody);
  }

  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ?")
    .get(invoiceId)) as Invoice;
  const lineItems = (await db
    .prepare(
      "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position ASC, id ASC"
    )
    .all(invoiceId)) as InvoiceItem[];
  return NextResponse.json({ ...invoice, items: lineItems }, { status: 201 });
}
