import { NextResponse } from "next/server";
import { getDb, type Invoice } from "@/lib/db";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Public (token-authorized) endpoint that mints a PaymentIntent the
 * customer can pay inline on /invoices/pay/[token] via the embedded
 * Stripe PaymentElement. Apple Pay / Google Pay (and any other wallets
 * enabled on the connected account) surface automatically when the
 * customer's device supports them — that's the closest thing to a
 * "tap to pay" UX we can do from a PWA without a native app.
 *
 * The /api/stripe/webhook handler reconciles the invoice to status=paid
 * when payment_intent.succeeded arrives, so we don't need a separate
 * client-side confirm step.
 */
export async function POST(
  _req: Request,
  { params }: { params: { token: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }
  const db = await getDb();
  const token = String(params.token || "");
  if (!token) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE stripe_pay_token = ? LIMIT 1")
    .get(token)) as Invoice | undefined;
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  const company = await getCompany(invoice.company_id);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 503 }
    );
  }
  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "This invoice has already been paid." },
      { status: 400 }
    );
  }
  if (invoice.status === "void") {
    return NextResponse.json(
      { error: "This invoice is no longer valid." },
      { status: 400 }
    );
  }

  const remaining = invoice.total_cents - invoice.paid_cents;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Nothing to pay on this invoice." },
      { status: 400 }
    );
  }

  const customer = (await db
    .prepare(
      "SELECT name, email FROM customers WHERE id = ? AND company_id = ?"
    )
    .get(invoice.customer_id, invoice.company_id)) as
    | { name: string | null; email: string | null }
    | undefined;

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((remaining * feeBps) / 10_000)
      : 0;

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create(
    {
      amount: remaining,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `${invoice.title?.trim() || `Invoice #${invoice.id}`} — ${
        customer?.name ?? ""
      }`.trim(),
      receipt_email: customer?.email || undefined,
      metadata: {
        invoice_id: String(invoice.id),
        customer_id: String(invoice.customer_id),
        pay_token: token,
        source: "invoice_inline",
      },
      ...(applicationFee > 0
        ? { application_fee_amount: applicationFee }
        : {}),
    },
    { stripeAccount: company.stripe_account_id }
  );

  // Track the latest intent on the invoice so the webhook can reconcile.
  await db
    .prepare(
      "UPDATE invoices SET stripe_payment_intent_id = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?"
    )
    .run(intent.id, invoice.id, invoice.company_id);

  return NextResponse.json({
    client_secret: intent.client_secret,
    payment_intent_id: intent.id,
    stripe_account: company.stripe_account_id,
    amount_cents: remaining,
  });
}
