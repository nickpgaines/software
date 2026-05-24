import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getOrCreateStripeCustomer,
  savePaymentMethodForCustomer,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Public (token-authorized) endpoint used by the subscription accept
 * page to collect a card on file. Mirrors the auth'd variant at
 * /api/stripe/customers/[customerId]/setup-intent, but identifies the
 * tenant + customer via the accept_token so the customer doesn't need a
 * session to save a card during signup.
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
  const sub = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE accept_token = ? LIMIT 1"
    )
    .get(params.token)) as CustomerSubscription | undefined;
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sub.status === "canceled" || sub.status === "declined") {
    return NextResponse.json(
      { error: "Subscription is no longer collectable" },
      { status: 400 }
    );
  }

  const company = await getCompany(sub.company_id);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return NextResponse.json(
      { error: "Payments aren't set up yet for this merchant." },
      { status: 503 }
    );
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    sub.company_id,
    sub.customer_id,
    company.stripe_account_id
  );

  const stripe = getStripe();
  const intent = await stripe.setupIntents.create(
    {
      customer: stripeCustomerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        company_id: String(sub.company_id),
        customer_id: String(sub.customer_id),
        subscription_id: String(sub.id),
        accept_token: params.token,
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

/**
 * After the SetupIntent is confirmed client-side, the accept page POSTs
 * here with the resulting PaymentMethod so we save it + set it as the
 * default for this subscription. Same token-as-auth pattern.
 *
 * Body: { setup_intent_id?: string, payment_method_id?: string }
 */
export async function PUT(
  req: Request,
  { params }: { params: { token: string } }
) {
  const db = await getDb();
  const sub = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE accept_token = ? LIMIT 1"
    )
    .get(params.token)) as CustomerSubscription | undefined;
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const company = await getCompany(sub.company_id);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      { error: "No connected Stripe account" },
      { status: 400 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    setup_intent_id: string;
    payment_method_id: string;
  }>;

  let paymentMethodId = body.payment_method_id?.trim() || "";
  if (!paymentMethodId && body.setup_intent_id?.trim()) {
    const stripe = getStripe();
    const si = await stripe.setupIntents.retrieve(
      body.setup_intent_id.trim(),
      undefined,
      { stripeAccount: company.stripe_account_id }
    );
    if (si.status !== "succeeded") {
      return NextResponse.json(
        { error: `SetupIntent not succeeded (status: ${si.status})` },
        { status: 400 }
      );
    }
    paymentMethodId =
      typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id || "";
  }
  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "Provide setup_intent_id or payment_method_id" },
      { status: 400 }
    );
  }

  try {
    const saved = await savePaymentMethodForCustomer({
      companyId: sub.company_id,
      customerId: sub.customer_id,
      stripeAccountId: company.stripe_account_id,
      stripePaymentMethodId: paymentMethodId,
      makeDefault: true,
    });
    // Lock this subscription onto the just-collected card so the future
    // charge endpoint uses exactly this PM, even if the customer adds
    // others later.
    await db
      .prepare(
        `UPDATE customer_subscriptions
           SET default_payment_method_id = ?
         WHERE id = ? AND company_id = ?`
      )
      .run(saved.stripe_payment_method_id, sub.id, sub.company_id);
    return NextResponse.json({ payment_method: saved }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not save card: ${message}` },
      { status: 400 }
    );
  }
}
