import { NextResponse } from "next/server";
import { getDb, type Invoice, type InvoiceItem } from "@/lib/db";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getAppOrigin,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Public endpoint (no auth) called from the pay page to mint a Stripe
 * Checkout session for an invoice. Returns { url } pointing at Stripe's
 * hosted checkout, or { error, status } if the invoice is paid/void/etc.
 *
 * Authorization is the opaque token in the URL — anyone who has the
 * link can pay. That's the design: links are sent to customers.
 */
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const company = await getCompany();
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 503 }
    );
  }

  const db = await getDb();
  const token = String(params.token || "");
  if (!token) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const invoice = (await db
    .prepare(
      "SELECT * FROM invoices WHERE stripe_pay_token = ? LIMIT 1"
    )
    .get(token)) as Invoice | undefined;
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json(
      { status: "paid", error: "This invoice has already been paid." },
      { status: 200 }
    );
  }
  if (invoice.status === "void") {
    return NextResponse.json(
      { status: "void", error: "This invoice is no longer valid." },
      { status: 200 }
    );
  }

  const items = (await db
    .prepare(
      "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position ASC, id ASC"
    )
    .all(invoice.id)) as InvoiceItem[];

  if (items.length === 0 || invoice.total_cents <= 0) {
    return NextResponse.json(
      { error: "Invoice has no payable items" },
      { status: 400 }
    );
  }

  const customer = (await db
    .prepare("SELECT name, email FROM customers WHERE id = ?")
    .get(invoice.customer_id)) as
    | { name: string | null; email: string | null }
    | undefined;

  // We pre-built the totals (including tax) on the server when the invoice
  // was created. To match that exactly in Stripe Checkout we send a single
  // line item for the grand total instead of trying to reconstruct each
  // line + tax there. This guarantees the customer is charged exactly
  // what the merchant invoiced.
  const titleLabel = invoice.title?.trim() || `Invoice #${invoice.id}`;

  const origin = getAppOrigin(req);
  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((invoice.total_cents * feeBps) / 10_000)
      : 0;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: invoice.total_cents,
            product_data: {
              name: titleLabel,
              description: items
                .map(
                  (it) =>
                    `${it.title}${it.quantity !== 1 ? ` × ${it.quantity}` : ""}`
                )
                .join(", ")
                .slice(0, 500),
            },
          },
        },
      ],
      customer_email: customer?.email || undefined,
      success_url: `${origin}/invoices/pay/${token}?status=success`,
      cancel_url: `${origin}/invoices/pay/${token}?status=cancel`,
      payment_intent_data: {
        description: `${titleLabel} — ${customer?.name ?? ""}`.trim(),
        metadata: {
          invoice_id: String(invoice.id),
          customer_id: String(invoice.customer_id),
          pay_token: token,
        },
        ...(applicationFee > 0
          ? { application_fee_amount: applicationFee }
          : {}),
      },
      metadata: {
        invoice_id: String(invoice.id),
        customer_id: String(invoice.customer_id),
        pay_token: token,
      },
    },
    { stripeAccount: company.stripe_account_id }
  );

  if (session.url) {
    await db
      .prepare(
        "UPDATE invoices SET stripe_checkout_session_id = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(session.id, invoice.id);
  }

  return NextResponse.json({ url: session.url });
}
