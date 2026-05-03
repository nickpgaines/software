import { NextResponse } from "next/server";
import {
  getDb,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
} from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "void",
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Invoice | undefined;
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = (await db
    .prepare(
      "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position ASC, id ASC"
    )
    .all(id)) as InvoiceItem[];
  return NextResponse.json({ ...invoice, items });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Invoice | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: InvoiceStatus;
    paid_cents: number;
  }>;
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const paidCents =
    body.paid_cents === undefined
      ? body.status === "paid"
        ? existing.total_cents
        : existing.paid_cents
      : Math.max(0, Number(body.paid_cents) || 0);
  const paidAt =
    body.status === "paid" ? existing.paid_at || now : existing.paid_at;
  const voidedAt =
    body.status === "void" ? existing.voided_at || now : existing.voided_at;

  await db
    .prepare(
      `UPDATE invoices
         SET status = ?, paid_cents = ?, paid_at = ?, voided_at = ?,
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(body.status, paidCents, paidAt, voidedAt, id, ctx.companyId);
  const row = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Invoice;
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await db
    .prepare("DELETE FROM invoices WHERE id = ? AND company_id = ?")
    .run(Number(params.id), ctx.companyId);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
