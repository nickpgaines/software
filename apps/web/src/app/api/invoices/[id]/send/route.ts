import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb, type Invoice } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  getCompany,
  isStripeConfigured,
  getAppOrigin,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

function makePayToken() {
  return randomBytes(24).toString("base64url");
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const companyId = ctx.companyId;
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Invoice | undefined;
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const customer = await db
    .prepare("SELECT id, name FROM customers WHERE id = ? AND company_id = ?")
    .get<{ id: number; name: string }>(invoice.customer_id, companyId);
  if (!customer) {
    return NextResponse.json({ error: "customer missing" }, { status: 404 });
  }

  let payToken = invoice.stripe_pay_token;
  let payUrl: string | null = null;
  if (isStripeConfigured()) {
    try {
      const company = await getCompany(companyId);
      if (company.stripe_account_id && company.stripe_charges_enabled) {
        if (!payToken) {
          payToken = makePayToken();
          await db
            .prepare(
              `UPDATE invoices SET stripe_pay_token = ? WHERE id = ? AND company_id = ?`
            )
            .run(payToken, id, companyId);
        }
        payUrl = `${getAppOrigin(req)}/invoices/pay/${payToken}`;
      }
    } catch (e) {
      console.error("Skipping pay link: failed to read Stripe state", e);
    }
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE invoices
         SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
             sent_at = COALESCE(sent_at, ?),
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(now, id, companyId);

  const payLine = payUrl ? `\nPay online: ${payUrl}` : "";
  const messageBody =
    `Hi ${customer.name}! Here's your invoice:\n` +
    `Amount due: ${formatPrice(invoice.total_cents - invoice.paid_cents)}` +
    payLine +
    `\nReply with any questions.`;
  await db
    .prepare(
      `INSERT INTO messages (company_id, customer_id, body, direction)
       VALUES (?, ?, ?, 'outbound')`
    )
    .run(companyId, invoice.customer_id, messageBody);

  const updated = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Invoice;
  return NextResponse.json(updated);
}
