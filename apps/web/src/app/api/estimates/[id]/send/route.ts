import { NextResponse } from "next/server";
import { getDb, type Estimate } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(
  _req: Request,
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
    `Total: ${formatPrice(estimate.total_cents)}` +
    `\nReply YES to accept.`;
  await db
    .prepare(
      `INSERT INTO messages (company_id, customer_id, body, direction)
       VALUES (?, ?, ?, 'outbound')`
    )
    .run(companyId, estimate.customer_id, messageBody);

  const updated = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Estimate;
  return NextResponse.json(updated);
}
