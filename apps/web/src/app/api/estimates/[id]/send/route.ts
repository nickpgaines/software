import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb, type Estimate } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { getAppOrigin } from "@/lib/stripe";
import { sendAndLogCompanySms } from "@/lib/sms";

export const dynamic = "force-dynamic";

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
  const estimate = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Estimate | undefined;
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const customer = await db
    .prepare("SELECT id, name FROM customers WHERE id = ? AND company_id = ?")
    .get<{ id: number; name: string }>(estimate.customer_id, companyId);
  if (!customer) {
    return NextResponse.json({ error: "customer missing" }, { status: 404 });
  }

  // Ensure an opaque accept token exists so the customer can open the public
  // review-and-sign page from the link below.
  let acceptToken = estimate.accept_token;
  if (!acceptToken) {
    acceptToken = randomBytes(24).toString("base64url");
    await db
      .prepare(
        `UPDATE estimates SET accept_token = ? WHERE id = ? AND company_id = ?`
      )
      .run(acceptToken, id, companyId);
  }
  const acceptUrl = `${getAppOrigin(req)}/estimates/accept/${acceptToken}`;

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE estimates
         SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
             sent_at = COALESCE(sent_at, ?),
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(now, id, companyId);

  const messageBody =
    `Hi ${customer.name}! Here's your estimate:\n` +
    `Total: ${formatPrice(estimate.total_cents)}\n` +
    `Review & sign: ${acceptUrl}`;
  await sendAndLogCompanySms({
    companyId,
    customerId: estimate.customer_id,
    body: messageBody,
  });

  const updated = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Estimate;
  return NextResponse.json(updated);
}
