import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getDb,
  type Customer,
  type SubscriptionInterval,
} from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  getCompany,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Subscription import: connect Forge to an existing book of Stripe
 * Subscriptions (typically from a previous CRM like Homebase360 or Jobber
 * that already drives billing through this same Stripe Connect account).
 *
 *   GET  → list every Stripe Subscription on this connected account that
 *          isn't already linked to a Forge row, with a best-guess match to
 *          a Forge customer (by email, then phone, then name).
 *   POST → for each {stripe_subscription_id, customer_id} pair, insert a
 *          customer_subscriptions row that points at the existing Stripe
 *          Sub. No new Stripe billing is created and the existing
 *          schedule is not touched — Stripe keeps charging on its cadence;
 *          Forge just becomes the system of record for that customer.
 *
 * Importing is reversible (delete the customer_subscriptions row; the
 * Stripe Sub itself stays untouched), and never causes duplicate billing
 * because Forge never bills a sub that has a stripe_subscription_id.
 */

type ImportInterval = SubscriptionInterval;

function mapStripeInterval(
  interval: Stripe.Price.Recurring.Interval | undefined,
  intervalCount: number | undefined
): ImportInterval | null {
  if (!interval || !intervalCount) return null;
  if (interval === "week" && intervalCount === 1) return "weekly";
  if (interval === "week" && intervalCount === 2) return "biweekly";
  if (interval === "month" && intervalCount === 1) return "monthly";
  if (interval === "month" && intervalCount === 3) return "quarterly";
  if (interval === "month" && intervalCount === 4) return "triannually";
  if (interval === "month" && intervalCount === 6) return "semiannually";
  if (interval === "year" && intervalCount === 1) return "yearly";
  return null;
}

function normalizePhone(p: string | null | undefined): string {
  return (p || "").replace(/\D+/g, "");
}

export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }
  try {
    const companyId = await requireCompanyId();
    const company = await getCompany(companyId);
    if (!company.stripe_account_id) {
      return NextResponse.json(
        {
          error:
            "No Stripe account is connected to this Forge company yet. Connect one in Settings → Payments first.",
        },
        { status: 400 }
      );
    }
    if (!company.stripe_charges_enabled) {
      return NextResponse.json(
        {
          error:
            "The connected Stripe account isn't ready to accept charges yet — finish onboarding in Stripe (Settings → Payments → Continue), then try again.",
        },
        { status: 400 }
      );
    }
    const stripe = getStripe();
    const db = await getDb();

    // Page through every Stripe Sub on the connected account. 22-customer
    // accounts return in one page; larger books paginate via starting_after.
    // Cap iterations defensively.
    const stripeSubs: Stripe.Subscription[] = [];
    let startingAfter: string | undefined = undefined;
    for (let page = 0; page < 20; page++) {
      const params: Stripe.SubscriptionListParams = {
        limit: 100,
        status: "all",
        // Stripe caps expand depth at 4 levels — data.items.data.price is
        // the max. We resolve product names via a separate retrieve loop
        // after the list, see below.
        expand: [
          "data.customer",
          "data.default_payment_method",
          "data.items.data.price",
        ],
      };
      if (startingAfter) params.starting_after = startingAfter;
      const res = await stripe.subscriptions.list(params, {
        stripeAccount: company.stripe_account_id,
      });
      for (const s of res.data) stripeSubs.push(s);
      if (!res.has_more || res.data.length === 0) break;
      startingAfter = res.data[res.data.length - 1].id;
    }

    // Collect unique product IDs referenced by the subs' prices, then
    // retrieve each so we can show the product name in the import list.
    // Most merchants reuse a small set of products across many subs, so
    // this is a handful of calls even for large books.
    const productIds = new Set<string>();
    for (const sub of stripeSubs) {
      for (const item of sub.items.data) {
        const pid = item.price?.product;
        if (typeof pid === "string") productIds.add(pid);
      }
    }
    const productNames = new Map<string, string>();
    for (const pid of productIds) {
      try {
        const p = await stripe.products.retrieve(pid, undefined, {
          stripeAccount: company.stripe_account_id,
        });
        if (p.name) productNames.set(p.id, p.name);
      } catch {
        // best-effort — fall back to price.nickname / synthetic name below
      }
    }

    // Build a lookup for Forge customers (small N — full table scan is fine
    // for the company sizes that hit this endpoint).
    const customers = (await db
      .prepare(
        "SELECT id, name, email, phone FROM customers WHERE company_id = ?"
      )
      .all(companyId)) as Pick<Customer, "id" | "name" | "email" | "phone">[];

    const byEmail = new Map<string, number>();
    const byPhone = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const c of customers) {
      if (c.email) byEmail.set(c.email.trim().toLowerCase(), c.id);
      const ph = normalizePhone(c.phone);
      if (ph) byPhone.set(ph, c.id);
      if (c.name) byName.set(c.name.trim().toLowerCase(), c.id);
    }

    // Which Stripe Sub IDs are already linked? The unique index on
    // stripe_subscription_id enforces this at the DB layer, but we surface
    // the flag in the UI so users don't try.
    const alreadyLinkedRows = (await db
      .prepare(
        `SELECT stripe_subscription_id FROM customer_subscriptions
          WHERE company_id = ? AND stripe_subscription_id IS NOT NULL`
      )
      .all(companyId)) as { stripe_subscription_id: string }[];
    const alreadyLinked = new Set(
      alreadyLinkedRows.map((r) => r.stripe_subscription_id)
    );

    const report = stripeSubs.map((sub) => {
    const stripeCustomer =
      sub.customer && typeof sub.customer !== "string" ? sub.customer : null;
    const isDeleted =
      stripeCustomer !== null &&
      (stripeCustomer as Stripe.DeletedCustomer).deleted;
    const customerName = !isDeleted
      ? (stripeCustomer as Stripe.Customer | null)?.name ?? null
      : null;
    const customerEmail = !isDeleted
      ? (stripeCustomer as Stripe.Customer | null)?.email ?? null
      : null;
    const customerPhone = !isDeleted
      ? (stripeCustomer as Stripe.Customer | null)?.phone ?? null
      : null;

    const item = sub.items.data[0];
    const price = item?.price;
    const amountCents = price?.unit_amount ?? 0;
    const recurring = price?.recurring;
    const interval = mapStripeInterval(
      recurring?.interval,
      recurring?.interval_count
    );

    // Best-guess Forge customer: email > phone > name. None of these are
    // certain — UI shows the suggestion and lets the user override.
    let matchId: number | null = null;
    let matchConfidence: "email" | "phone" | "name" | null = null;
    if (customerEmail) {
      const id = byEmail.get(customerEmail.trim().toLowerCase());
      if (id) {
        matchId = id;
        matchConfidence = "email";
      }
    }
    if (!matchId) {
      const ph = normalizePhone(customerPhone);
      if (ph) {
        const id = byPhone.get(ph);
        if (id) {
          matchId = id;
          matchConfidence = "phone";
        }
      }
    }
    if (!matchId && customerName) {
      const id = byName.get(customerName.trim().toLowerCase());
      if (id) {
        matchId = id;
        matchConfidence = "name";
      }
    }

    const pm =
      sub.default_payment_method &&
      typeof sub.default_payment_method !== "string"
        ? sub.default_payment_method
        : null;
    const card = pm?.card ?? null;

    // Product name comes from the productNames map we built above.
    // Fall back to the price's nickname when set (some integrations
    // store the display name there instead of on the product).
    const productIdStr =
      typeof price?.product === "string" ? price.product : null;
    const productName =
      (productIdStr ? productNames.get(productIdStr) : null) ||
      price?.nickname ||
      null;

    // Stripe SDK v22 moved current_period_end onto each subscription item.
    // For our single-price subs the first item carries the period boundary.
    const periodEndSec = item?.current_period_end ?? null;

    return {
      stripe_subscription_id: sub.id,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: periodEndSec
        ? new Date(periodEndSec * 1000).toISOString()
        : null,
      amount_cents: amountCents,
      currency: price?.currency ?? "usd",
      interval,
      interval_raw:
        recurring?.interval && recurring?.interval_count
          ? `${recurring.interval_count} × ${recurring.interval}`
          : null,
      name:
        productName ||
        sub.metadata?.product_name ||
        `Subscription ${sub.id.slice(-8)}`,
      stripe_customer_id:
        typeof sub.customer === "string"
          ? sub.customer
          : sub.customer?.id ?? null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      payment_method_brand: card?.brand ?? null,
      payment_method_last4: card?.last4 ?? null,
      matched_forge_customer_id: matchId,
      matched_by: matchConfidence,
      already_imported: alreadyLinked.has(sub.id),
    };
  });

    return NextResponse.json({
      stripe_subscriptions: report,
      forge_customers: customers,
    });
  } catch (e) {
    const err = e as {
      type?: string;
      code?: string;
      raw?: { type?: string; code?: string };
      message?: string;
    };
    const code = err.code || err.raw?.code || "";
    const type = err.type || err.raw?.type || "";
    const message = err.message || "Unknown error";

    // The most common real-world failure here is the same Connect-revoked
    // case the Settings page hits: the stored stripe_account_id is no
    // longer accessible to the platform key. Translate that into a
    // friendly "reconnect" pointer instead of a raw Stripe error.
    if (
      type === "StripePermissionError" ||
      type === "invalid_request_error" ||
      code === "permission_error" ||
      code === "resource_missing" ||
      code === "account_invalid"
    ) {
      return NextResponse.json(
        {
          error:
            "The connected Stripe account is no longer accessible to Forge. Go to Settings → Payments and reconnect, then retry.",
        },
        { status: 400 }
      );
    }

    console.error("GET /api/customer-subscriptions/import failed:", e);
    return NextResponse.json(
      { error: `Could not list Stripe subscriptions: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }
  const companyId = await requireCompanyId();
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) {
    return NextResponse.json(
      { error: "Connect a Stripe account before importing subscriptions." },
      { status: 400 }
    );
  }
  const db = await getDb();
  const stripe = getStripe();

  const body = (await req.json().catch(() => ({}))) as Partial<{
    links: { stripe_subscription_id: string; customer_id: number }[];
  }>;
  const links = Array.isArray(body.links) ? body.links : [];
  if (links.length === 0) {
    return NextResponse.json(
      { error: "No subscriptions selected to import" },
      { status: 400 }
    );
  }

  type LinkResult =
    | { ok: true; stripe_subscription_id: string; row_id: number }
    | { ok: false; stripe_subscription_id: string; error: string };
  const results: LinkResult[] = [];

  // One batch tag per import run so an admin can review or roll back later.
  const batchTag = `stripe-link-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  for (const link of links) {
    const stripeSubId = String(link.stripe_subscription_id || "").trim();
    const customerId = Number(link.customer_id);
    if (!stripeSubId || !Number.isFinite(customerId) || customerId <= 0) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error: "Invalid stripe_subscription_id or customer_id",
      });
      continue;
    }

    const customer = await db
      .prepare(
        "SELECT id FROM customers WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get<{ id: number }>(customerId, companyId);
    if (!customer) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error: "Customer not found",
      });
      continue;
    }

    const existing = await db
      .prepare(
        `SELECT id FROM customer_subscriptions
          WHERE company_id = ? AND stripe_subscription_id = ? LIMIT 1`
      )
      .get<{ id: number }>(companyId, stripeSubId);
    if (existing) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error: "Already imported",
      });
      continue;
    }

    let stripeSub: Stripe.Subscription;
    try {
      stripeSub = await stripe.subscriptions.retrieve(
        stripeSubId,
        { expand: ["items.data.price.product"] },
        { stripeAccount: company.stripe_account_id }
      );
    } catch (e) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error: e instanceof Error ? e.message : "Stripe subscription not found",
      });
      continue;
    }

    const item = stripeSub.items.data[0];
    const price = item?.price;
    const amountCents = price?.unit_amount ?? 0;
    const interval = mapStripeInterval(
      price?.recurring?.interval,
      price?.recurring?.interval_count
    );
    if (!interval) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error:
          "Stripe sub uses an interval Forge can't represent (only weekly, biweekly, monthly, quarterly, 4-monthly, 6-monthly, yearly)",
      });
      continue;
    }
    if (amountCents <= 0) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error: "Stripe sub has no recurring amount",
      });
      continue;
    }

    const productName =
      typeof price?.product === "object" &&
      price?.product &&
      !("deleted" in price.product)
        ? (price.product as Stripe.Product).name
        : `Subscription ${stripeSub.id.slice(-8)}`;

    const startDateIso = stripeSub.start_date
      ? new Date(stripeSub.start_date * 1000).toISOString().slice(0, 10)
      : null;

    const forgeStatus =
      stripeSub.status === "canceled" ? "canceled" : "active";
    const billingStatus =
      stripeSub.status === "past_due" ? "past_due" : "current";

    try {
      const res = await db
        .prepare(
          `INSERT INTO customer_subscriptions
             (company_id, customer_id, name, description, price_cents,
              interval, service_interval, status, accepted_at,
              start_date, tax_rate_bps,
              stripe_subscription_id, stripe_subscription_status,
              billing_status, auto_bill,
              imported_from, import_batch, created_by)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, datetime('now'), ?, 0, ?, ?, ?, 0, 'stripe', ?, 'import')`
        )
        .run(
          companyId,
          customerId,
          productName,
          amountCents,
          interval,
          interval,
          forgeStatus,
          startDateIso,
          stripeSub.id,
          stripeSub.status,
          billingStatus,
          batchTag
        );
      results.push({
        ok: true,
        stripe_subscription_id: stripeSubId,
        row_id: Number(res.lastInsertRowid),
      });
    } catch (e) {
      results.push({
        ok: false,
        stripe_subscription_id: stripeSubId,
        error: e instanceof Error ? e.message : "Insert failed",
      });
    }
  }

  const imported = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({
    batch: batchTag,
    imported,
    failed,
    results,
  });
}
