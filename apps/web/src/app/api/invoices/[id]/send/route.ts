import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb, type Invoice } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  getCompany,
  isStripeConfigured,
  getAppOrigin,
} from "@/lib/stripe";
import { sendAndLogCompanySms } from "@/lib/sms";

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

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe isn't configured on this deployment. Contact support before sending invoices.",
      },
      { status: 400 }
    );
  }
  const company = await getCompany(companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      {
        error:
          "Connect your Stripe account in Settings → Payments before sending invoices. Customers won't have a way to pay otherwise.",
      },
      { status: 400 }
    );
  }

  let payToken = invoice.stripe_pay_token;
  if (!payToken) {
    payToken = makePayToken();
    await db
      .prepare(
        `UPDATE invoices SET stripe_pay_token = ? WHERE id = ? AND company_id = ?`
      )
      .run(payToken, id, companyId);
  }
  const payUrl = `${getAppOrigin(req)}/invoices/pay/${payToken}`;

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

  const messageBody =
    `Hi ${customer.name}! Here's your invoice:\n` +
    `Amount due: ${formatPrice(invoice.total_cents - invoice.paid_cents)}\n` +
    `Pay online: ${payUrl}\n` +
    `Reply with any questions.`;
  await sendAndLogCompanySms({
    companyId,
    customerId: invoice.customer_id,
    body: messageBody,
  });

  const updated = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Invoice;
  return NextResponse.json(updated);
}
