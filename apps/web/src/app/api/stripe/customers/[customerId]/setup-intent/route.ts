import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getOrCreateStripeCustomer,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Mint a SetupIntent for collecting a card to keep on file against the
 * merchant's connected Stripe account. The frontend confirms it with
 * stripe.confirmSetup() / PaymentElement, then POSTs to
 * /api/stripe/customers/[customerId]/payment-methods to persist it.
 *
 * Direct-charge model: the Customer + PaymentMethod live on the
 * connected account, so every Stripe call carries `stripeAccount`.
 */
export async function POST(
  _req: Request,
  { params }: { params: { customerId: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured" },
      { status: 503 }
    );
  }

  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      {
        error:
          "Connect a Stripe account in Settings → Payments before saving cards.",
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

  const customerId = Number(params.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return NextResponse.json(
      { error: "Invalid customer id" },
      { status: 400 }
    );
  }
  const db = await getDb();
  const customer = await db
    .prepare(
      "SELECT id FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(customerId, companyId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    companyId,
    customerId,
    company.stripe_account_id
  );

  const stripe = getStripe();
  const intent = await stripe.setupIntents.create(
    {
      customer: stripeCustomerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        company_id: String(companyId),
        customer_id: String(customerId),
      },
    },
    { stripeAccount: company.stripe_account_id }
  );

  return NextResponse.json({
    client_secret: intent.client_secret,
    setup_intent_id: intent.id,
    stripe_account: company.stripe_account_id,
    stripe_customer_id: stripeCustomerId,
  });
}
