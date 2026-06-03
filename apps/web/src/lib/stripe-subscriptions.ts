import "server-only";
import type Stripe from "stripe";
import {
  getDb,
  type Db,
  type Company,
  type CustomerSubscription,
  type SubscriptionInterval,
} from "./db";
import {
  getStripe,
  getCompany,
  getOrCreateStripeCustomer,
} from "./stripe";

// Map our interval enum to Stripe's recurring.{interval, interval_count}.
// Stripe only natively supports day/week/month/year + a count, so multi-month
// cadences (quarterly etc.) are expressed as N months.
function intervalToStripeRecurring(i: SubscriptionInterval): {
  interval: "day" | "week" | "month" | "year";
  interval_count: number;
} {
  switch (i) {
    case "weekly":
      return { interval: "week", interval_count: 1 };
    case "biweekly":
      return { interval: "week", interval_count: 2 };
    case "monthly":
      return { interval: "month", interval_count: 1 };
    case "quarterly":
      return { interval: "month", interval_count: 3 };
    case "triannually":
      return { interval: "month", interval_count: 4 };
    case "semiannually":
      return { interval: "month", interval_count: 6 };
    case "yearly":
      return { interval: "year", interval_count: 1 };
  }
}

export type CreateStripeSubResult =
  | {
      ok: true;
      stripeSubscriptionId: string;
      currentPeriodEnd: string | null;
      latestInvoiceId: string | null;
      stripeStatus: string;
    }
  | { ok: false; error: string };

/**
 * Create a Stripe Subscription on the connected account for one Forge
 * customer_subscriptions row. After this returns ok, Stripe runs the
 * recurring billing on its own schedule and Forge syncs state via webhooks —
 * Forge never creates PaymentIntents directly for this subscription again.
 *
 * The Stripe Product + Price are created fresh per Forge sub so the membership
 * name and unique amount show up cleanly on invoices and statements (matches
 * how Homebase360 and other field-service CRMs structure their Stripe Subs).
 *
 * `paymentMethodId` is required: Stripe Subscriptions need a default PM at
 * creation time. The accept flow locks this in via the SetupIntent; for
 * merchant-initiated activation, falls back to the customer's saved default.
 */
export async function createStripeSubscriptionForRow(args: {
  companyId: number;
  customerId: number;
  subscriptionRowId: number;
  productName: string;
  productDescription?: string | null;
  amountCents: number;
  interval: SubscriptionInterval;
  paymentMethodId?: string | null;
  // ISO; if in the future, the first charge is delayed via Stripe trial_end.
  // Stripe's billing_cycle_anchor would charge a prorated first period, which
  // is not what we want — trial_end is the right tool for "start on this date".
  startDateIso?: string | null;
}): Promise<CreateStripeSubResult> {
  const company = await getCompany(args.companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return { ok: false, error: "stripe_not_ready" };
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    args.companyId,
    args.customerId,
    company.stripe_account_id
  );

  const db = await getDb();
  let pmId: string | null = args.paymentMethodId || null;
  if (!pmId) {
    const pm = await db
      .prepare(
        `SELECT stripe_payment_method_id FROM stripe_payment_methods
          WHERE company_id = ? AND customer_id = ?
          ORDER BY is_default DESC, created_at DESC, id DESC LIMIT 1`
      )
      .get<{ stripe_payment_method_id: string }>(
        args.companyId,
        args.customerId
      );
    pmId = pm?.stripe_payment_method_id ?? null;
  }
  if (!pmId) return { ok: false, error: "no_card" };

  const stripe = getStripe();
  const recurring = intervalToStripeRecurring(args.interval);

  let product: Stripe.Product;
  try {
    product = await stripe.products.create(
      {
        name: args.productName,
        description: args.productDescription || undefined,
        metadata: {
          forge_subscription_id: String(args.subscriptionRowId),
          forge_company_id: String(args.companyId),
          forge_customer_id: String(args.customerId),
        },
      },
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Stripe product create failed",
    };
  }

  let price: Stripe.Price;
  try {
    price = await stripe.prices.create(
      {
        unit_amount: args.amountCents,
        currency: "usd",
        recurring,
        product: product.id,
      },
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Stripe price create failed",
    };
  }

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFeePercent =
    Number.isFinite(feeBps) && feeBps > 0 ? feeBps / 100 : undefined;

  const subParams: Stripe.SubscriptionCreateParams = {
    customer: stripeCustomerId,
    items: [{ price: price.id }],
    default_payment_method: pmId,
    payment_settings: { payment_method_types: ["card"] },
    collection_method: "charge_automatically",
    metadata: {
      forge_subscription_id: String(args.subscriptionRowId),
      forge_company_id: String(args.companyId),
      forge_customer_id: String(args.customerId),
    },
    ...(applicationFeePercent !== undefined
      ? { application_fee_percent: applicationFeePercent }
      : {}),
  };

  if (args.startDateIso) {
    const anchorSec = Math.floor(new Date(args.startDateIso).getTime() / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    // Only defer if the start date is meaningfully in the future. A start date
    // in the past or right now means "bill the first period immediately",
    // which is Stripe's default behavior — no trial_end needed.
    if (Number.isFinite(anchorSec) && anchorSec > nowSec + 60) {
      subParams.trial_end = anchorSec;
    }
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.create(subParams, {
      stripeAccount: company.stripe_account_id,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Stripe subscription create failed",
    };
  }

  const latestInvoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id ?? null;

  // Stripe SDK v22 moved current_period_end onto each subscription item.
  // For single-item subs (Forge always creates these as single-price) the
  // first item's period end is the subscription's effective period end.
  const periodEndSec = subscription.items.data[0]?.current_period_end ?? null;

  return {
    ok: true,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: periodEndSec
      ? new Date(periodEndSec * 1000).toISOString()
      : null,
    latestInvoiceId,
    stripeStatus: subscription.status,
  };
}

/**
 * Cancel the Stripe Subscription tied to a Forge row. Idempotent — calling
 * twice (or on a sub that's already canceled) is safe; Stripe returns the
 * already-canceled object.
 */
export async function cancelStripeSubscription(
  companyId: number,
  stripeSubscriptionId: string
): Promise<void> {
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) return;
  const stripe = getStripe();
  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId, undefined, {
      stripeAccount: company.stripe_account_id,
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    // Already-canceled subs throw "resource_missing" or status: canceled —
    // both are fine, we already wanted that end state.
    if (code === "resource_missing") return;
    throw e;
  }
}

/**
 * Pause Stripe's automatic collection on the sub. behavior=void means
 * upcoming invoices are voided (not held / not piled up). When resumed,
 * billing picks up at the next scheduled cycle.
 */
export async function pauseStripeSubscription(
  companyId: number,
  stripeSubscriptionId: string
): Promise<void> {
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) return;
  const stripe = getStripe();
  await stripe.subscriptions.update(
    stripeSubscriptionId,
    { pause_collection: { behavior: "void" } },
    { stripeAccount: company.stripe_account_id }
  );
}

export async function resumeStripeSubscription(
  companyId: number,
  stripeSubscriptionId: string
): Promise<void> {
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) return;
  const stripe = getStripe();
  await stripe.subscriptions.update(
    stripeSubscriptionId,
    { pause_collection: null },
    { stripeAccount: company.stripe_account_id }
  );
}

/**
 * "Charge now" path. Creates an off-cycle invoice item + invoice on the
 * existing Stripe Subscription and immediately attempts payment. This records
 * on the same Stripe Sub's history (so it's visible on the customer's
 * statement next to their normal recurring charges), and the regular schedule
 * continues unaffected.
 */
export async function chargeStripeSubscriptionNow(args: {
  companyId: number;
  stripeSubscriptionId: string;
  amountCents: number;
  description?: string;
}): Promise<
  | { ok: true; invoiceId: string; paymentIntentId: string | null }
  | { ok: false; error: string }
> {
  const company = await getCompany(args.companyId);
  if (!company.stripe_account_id) {
    return { ok: false, error: "stripe_not_ready" };
  }
  const stripe = getStripe();

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(
      args.stripeSubscriptionId,
      undefined,
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Subscription not found in Stripe",
    };
  }
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!stripeCustomerId) {
    return { ok: false, error: "subscription has no customer" };
  }

  try {
    await stripe.invoiceItems.create(
      {
        customer: stripeCustomerId,
        subscription: args.stripeSubscriptionId,
        amount: args.amountCents,
        currency: "usd",
        description: args.description || "Manual charge",
      },
      { stripeAccount: company.stripe_account_id }
    );
    const invoice = await stripe.invoices.create(
      {
        customer: stripeCustomerId,
        subscription: args.stripeSubscriptionId,
        auto_advance: true,
        collection_method: "charge_automatically",
      },
      { stripeAccount: company.stripe_account_id }
    );
    if (!invoice.id) {
      return { ok: false, error: "Stripe invoice was created without an id" };
    }
    const paid = await stripe.invoices.pay(invoice.id, undefined, {
      stripeAccount: company.stripe_account_id,
    });
    // SDK v22 removed paid.payment_intent in favor of paid.payments[*].
    // Probe both shapes — Stripe's wire response may still include the
    // legacy field on older API version pins.
    const legacyPi = (
      paid as unknown as { payment_intent?: string | Stripe.PaymentIntent }
    ).payment_intent;
    let piId: string | null = null;
    if (typeof legacyPi === "string") piId = legacyPi;
    else if (legacyPi && typeof legacyPi === "object" && "id" in legacyPi)
      piId = legacyPi.id;
    if (!piId) {
      const first = paid.payments?.data?.[0]?.payment?.payment_intent;
      if (typeof first === "string") piId = first;
      else if (first && typeof first === "object" && "id" in first)
        piId = first.id;
    }
    return { ok: true, invoiceId: paid.id, paymentIntentId: piId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Charge failed",
    };
  }
}

/**
 * Find a customer_subscriptions row by its linked Stripe Sub ID, scoped by
 * the company that owns the connected Stripe account. Used by webhook
 * handlers to resolve incoming events to a local row.
 */
export async function findSubByStripeId(
  db: Db,
  companyId: number,
  stripeSubscriptionId: string
): Promise<CustomerSubscription | undefined> {
  return (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ? AND stripe_subscription_id = ?
        LIMIT 1`
    )
    .get(companyId, stripeSubscriptionId)) as
    | CustomerSubscription
    | undefined;
}

// Re-export for callers that want the company type without importing db.
export type { Company };
