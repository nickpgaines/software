import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
  getOrCreateStripeCustomer,
  savePaymentMethodForCustomer,
} from "@/lib/stripe";
import { createStripeSubscriptionForRow } from "@/lib/stripe-subscriptions";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";

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
  // Lock to card only — no Bank / Cash App / Link tabs in the PaymentElement.
  // Wallets (Apple/Google Pay) are still surfaced separately on supported
  // devices via the PaymentElement's wallets option, not via this list.
  const intent = await stripe.setupIntents.create(
    {
      customer: stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
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

  let saved;
  try {
    saved = await savePaymentMethodForCustomer({
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not save card: ${message}` },
      { status: 400 }
    );
  }

  // Card is now saved. If the customer has accepted (accepted_at is set,
  // and signature_data exists when required) and there's no Stripe Sub yet,
  // create one now using the just-saved PM, then atomically flip status to
  // 'active' and seed the rolling visit window. This is the ONLY place an
  // accept-flow sub becomes active — keeps "active" a strict invariant:
  // accepted + card on file + Stripe Sub linked.
  //
  // Re-read so we see signature/accepted_at writes from the POST that
  // could have raced this PUT on a flaky network.
  const fresh = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(sub.id, sub.company_id)) as CustomerSubscription | undefined;
  if (!fresh) {
    return NextResponse.json({ payment_method: saved }, { status: 201 });
  }
  if (fresh.stripe_subscription_id) {
    // Already linked from a prior call — return idempotently.
    return NextResponse.json({ payment_method: saved }, { status: 201 });
  }
  if (!fresh.accepted_at) {
    // Card was saved but the customer never tapped accept. Don't activate;
    // they can still come back and complete via the accept page.
    return NextResponse.json(
      {
        payment_method: saved,
        warning: "Card saved but subscription not yet accepted",
      },
      { status: 201 }
    );
  }
  if (fresh.require_signature && !fresh.signature_data) {
    return NextResponse.json(
      {
        payment_method: saved,
        warning: "Card saved but signature is still required",
      },
      { status: 201 }
    );
  }

  const stripeResult = await createStripeSubscriptionForRow({
    companyId: fresh.company_id,
    customerId: fresh.customer_id,
    subscriptionRowId: fresh.id,
    productName: fresh.name,
    productDescription: fresh.description,
    amountCents: fresh.price_cents,
    interval: fresh.interval,
    paymentMethodId: saved.stripe_payment_method_id,
    startDateIso: fresh.start_date
      ? startDateToIso(fresh.start_date)
      : null,
  });
  if (!stripeResult.ok) {
    // Stripe Sub creation failed — leave the row pending so admin can retry.
    // Status stays 'pending', no visits seeded, customer sees the error so
    // they know to follow up. This is the desired strict behavior.
    console.error(
      `Stripe Subscription creation failed for sub ${fresh.id} after PM save:`,
      stripeResult.error
    );
    return NextResponse.json(
      {
        payment_method: saved,
        stripe_subscription_error: stripeResult.error,
      },
      { status: 201 }
    );
  }

  // Atomically: link Stripe Sub, flip status to active. Visit seeding
  // happens next (best-effort — the row update is the source-of-truth
  // commit and shouldn't be blocked by visit-scheduler issues).
  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET stripe_subscription_id = ?,
             stripe_subscription_status = ?,
             status = 'active'
       WHERE id = ? AND company_id = ?`
    )
    .run(
      stripeResult.stripeSubscriptionId,
      stripeResult.stripeStatus,
      fresh.id,
      fresh.company_id
    );

  try {
    const now = new Date().toISOString();
    await ensureRollingVisits(db, {
      subscriptionId: fresh.id,
      customerId: fresh.customer_id,
      companyId: fresh.company_id,
      startDateIso: startDateToIso(fresh.start_date || now),
      serviceInterval: fresh.service_interval,
      pricePerVisitCents: fresh.price_cents,
      visitName: fresh.name,
      visitDescription: fresh.description,
      soldById: fresh.sold_by_id,
      technicianId: null,
    });
  } catch (e) {
    console.error(
      `ensureRollingVisits failed after activating sub ${fresh.id}:`,
      e
    );
  }

  return NextResponse.json({ payment_method: saved }, { status: 201 });
}
