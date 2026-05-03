import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb, type Invoice } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { getCompany, isStripeConfigured, getAppOrigin } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function makeToken() {
  // 24 bytes → 32 char URL-safe base64. Plenty of entropy, short URLs.
  return randomBytes(24).toString("base64url");
}

/**
 * Returns a public pay URL for the invoice. Generates an opaque token
 * the first time it's called and reuses it on subsequent calls so a
 * single invoice always has one stable link.
 *
 * The actual Stripe Checkout session is created on demand when the
 * customer hits the pay page (so it doesn't expire before they click).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured" },
      { status: 503 }
    );
  }

  const company = await getCompany(ctx.companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      {
        error:
          "Connect a Stripe account in Settings → Payments before sending pay links.",
      },
      { status: 400 }
    );
  }
  if (!company.stripe_charges_enabled) {
    return NextResponse.json(
      {
        error:
          "The connected Stripe account can't accept charges yet. Finish onboarding in Settings → Payments.",
      },
      { status: 400 }
    );
  }

  const db = await getDb();
  const id = Number(params.id);
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Invoice | undefined;
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "Invoice is already paid" },
      { status: 400 }
    );
  }
  if (invoice.status === "void") {
    return NextResponse.json(
      { error: "Invoice is voided" },
      { status: 400 }
    );
  }
  if (invoice.total_cents <= 0) {
    return NextResponse.json(
      { error: "Invoice total must be greater than zero" },
      { status: 400 }
    );
  }

  let token = invoice.stripe_pay_token;
  if (!token) {
    token = makeToken();
    await db
      .prepare(
        "UPDATE invoices SET stripe_pay_token = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?"
      )
      .run(token, id, ctx.companyId);
  }

  const origin = getAppOrigin(req);
  return NextResponse.json({
    url: `${origin}/invoices/pay/${token}`,
    token,
  });
}
