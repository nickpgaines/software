import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  getDb,
  type CustomerSubscription,
  type SubscriptionInterval,
  type SubscriptionTemplate,
  type SubscriptionTerms,
} from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";
import { createStripeSubscriptionForRow } from "@/lib/stripe-subscriptions";
import { getAppOrigin } from "@/lib/stripe";
import { sendAndLogCompanySms } from "@/lib/sms";

function makeAcceptToken() {
  return randomBytes(24).toString("base64url");
}

export const dynamic = "force-dynamic";

const VALID_INTERVALS: SubscriptionInterval[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "triannually",
  "semiannually",
  "yearly",
];

function intervalLabel(i: SubscriptionInterval): string {
  switch (i) {
    case "weekly":
      return "week";
    case "biweekly":
      return "2 weeks";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    case "triannually":
      return "4 months";
    case "semiannually":
      return "6 months";
    case "yearly":
      return "year";
  }
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const db = await getDb();
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");

  let rows: CustomerSubscription[];
  if (customerId) {
    rows = (await db
      .prepare(
        `SELECT * FROM customer_subscriptions
         WHERE customer_id = ? AND company_id = ?
         ORDER BY created_at DESC, id DESC`
      )
      .all(Number(customerId), companyId)) as CustomerSubscription[];
  } else {
    rows = (await db
      .prepare(
        `SELECT * FROM customer_subscriptions
         WHERE company_id = ?
         ORDER BY created_at DESC, id DESC`
      )
      .all(companyId)) as CustomerSubscription[];
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = ctx.identity;
  const companyId = ctx.companyId;
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    customer_id: number;
    template_id: number;
    action: "send" | "accept";
    name: string;
    description: string | null;
    price_cents: number;
    interval: SubscriptionInterval;
    signature_data: string;
    signature_name: string;
    start_date: string;
    sold_by_id: number | null;
    tax_rate_bps: number;
  }>;

  const customerId = Number(body.customer_id);
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }
  const action = body.action === "accept" ? "accept" : "send";

  let name = (body.name || "").trim();
  let description = body.description?.toString().trim() || null;
  const priceProvided = body.price_cents !== undefined;
  let price_cents = priceProvided
    ? Math.max(0, Number(body.price_cents) || 0)
    : 0;
  if (priceProvided && price_cents <= 0) {
    return NextResponse.json(
      { error: "price must be greater than zero" },
      { status: 400 }
    );
  }
  if (!body.interval || !VALID_INTERVALS.includes(body.interval)) {
    return NextResponse.json(
      { error: "interval is required" },
      { status: 400 }
    );
  }
  const interval: SubscriptionInterval = body.interval;
  let serviceInterval: SubscriptionInterval = interval;
  let templateId: number | null = null;
  let termsSnapshot: string | null = null;
  let requireSignature = 0;
  let taxRateBps =
    body.tax_rate_bps === undefined
      ? 0
      : Math.max(0, Math.round(Number(body.tax_rate_bps) || 0));

  if (body.template_id) {
    const tpl = (await db
      .prepare(
        "SELECT * FROM subscription_templates WHERE id = ? AND company_id = ?"
      )
      .get(Number(body.template_id), companyId)) as
      | SubscriptionTemplate
      | undefined;
    if (!tpl) {
      return NextResponse.json(
        { error: "template not found" },
        { status: 404 }
      );
    }
    templateId = tpl.id;
    if (!name) name = tpl.name;
    if (!description) description = tpl.description;
    requireSignature = tpl.require_signature ? 1 : 0;
    if (body.tax_rate_bps === undefined) taxRateBps = tpl.tax_rate_bps || 0;
    serviceInterval =
      tpl.service_interval && VALID_INTERVALS.includes(tpl.service_interval)
        ? tpl.service_interval
        : interval;
    if (tpl.terms_id) {
      const terms = (await db
        .prepare(
          "SELECT * FROM subscription_terms WHERE id = ? AND company_id = ?"
        )
        .get(tpl.terms_id, companyId)) as SubscriptionTerms | undefined;
      if (terms) {
        termsSnapshot = `${terms.name}\n\n${terms.body}`;
      }
    }
  }

  if (!priceProvided || price_cents <= 0) {
    return NextResponse.json(
      { error: "price is required" },
      { status: 400 }
    );
  }

  const signatureData =
    typeof body.signature_data === "string" && body.signature_data.trim()
      ? body.signature_data.trim()
      : null;
  const signatureName =
    typeof body.signature_name === "string" && body.signature_name.trim()
      ? body.signature_name.trim()
      : null;

  if (action === "accept" && requireSignature && !signatureData) {
    return NextResponse.json(
      { error: "signature is required for this subscription" },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: "name or template_id is required" },
      { status: 400 }
    );
  }

  const customer = await db
    .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
    .get<{ id: number }>(customerId, companyId);
  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  // Status is always pending at insert time. For action='accept' we'll
  // attempt Stripe Subscription creation below and only promote to 'active'
  // if it succeeds — keeps "active" a strict invariant (accepted + card on
  // file + Stripe Sub linked).
  const status = "pending";
  const sentAt = action === "send" ? now : null;
  const acceptedAt = action === "accept" ? now : null;
  const signedAt = signatureData ? now : null;
  const startDate =
    typeof body.start_date === "string" && body.start_date.trim()
      ? body.start_date.trim()
      : null;
  const soldById =
    body.sold_by_id === undefined || body.sold_by_id === null
      ? null
      : Number(body.sold_by_id) || null;

  const acceptToken = makeAcceptToken();

  const result = await db
    .prepare(
      `INSERT INTO customer_subscriptions
         (company_id, customer_id, template_id, name, description, price_cents, interval,
          service_interval,
          status, sent_at, accepted_at, created_by,
          terms_snapshot, require_signature,
          signature_data, signature_name, signed_at,
          start_date, sold_by_id, tax_rate_bps, accept_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      customerId,
      templateId,
      name,
      description,
      price_cents,
      interval,
      serviceInterval,
      status,
      sentAt,
      acceptedAt,
      user,
      termsSnapshot,
      requireSignature,
      signatureData,
      signatureName,
      signedAt,
      startDate,
      soldById,
      taxRateBps,
      acceptToken
    );
  const subscriptionId = Number(result.lastInsertRowid);

  if (action === "accept") {
    // Try to create the Stripe Subscription on the customer's saved card.
    // Only promote the row to 'active' if Stripe Sub creation succeeds —
    // a sub without recurring billing wired up should NOT show as active.
    const stripeResult = await createStripeSubscriptionForRow({
      companyId,
      customerId,
      subscriptionRowId: subscriptionId,
      productName: name,
      productDescription: description,
      amountCents: price_cents,
      interval,
      startDateIso: startDateToIso(startDate),
    });
    if (stripeResult.ok) {
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
          subscriptionId,
          companyId
        );
      try {
        await ensureRollingVisits(db, {
          subscriptionId,
          customerId,
          companyId,
          startDateIso: startDateToIso(startDate),
          serviceInterval,
          pricePerVisitCents: price_cents,
          visitName: name,
          visitDescription: description,
          soldById,
          technicianId: null,
        });
      } catch (e) {
        // Seeding the rolling window is best-effort — log and continue so
        // the subscription itself still saves. The /api/cron/subscription-visits
        // top-up will catch up on the next run.
        console.error("ensureRollingVisits failed", e);
      }
    } else {
      // Stripe Sub creation failed (usually no_card if the customer has no
      // saved card yet). Leave the row pending; the merchant can save a
      // card to the customer and re-attempt activation via the accept flow.
      console.error(
        `Stripe Subscription creation failed for sub ${subscriptionId}:`,
        stripeResult.error
      );
    }
  }

  if (action === "send") {
    const offerLine = `${name} — ${formatPrice(price_cents)} / ${intervalLabel(interval)}`;
    const desc = description ? `\n${description}` : "";
    // Use getAppOrigin so the link respects APP_URL — matches invoices/estimates
    // sends. Without it, a sub created from a Vercel preview URL would mint a
    // preview-domain link that points at the preview's database, which then
    // 404s for the customer on open.
    const acceptUrl = `${getAppOrigin(req)}/subscriptions/accept/${acceptToken}`;
    const messageBody =
      `Hi! Here's a subscription offer from us:\n${offerLine}${desc}\n` +
      `Tap to review & sign: ${acceptUrl}`;
    await sendAndLogCompanySms({
      companyId,
      customerId,
      body: messageBody,
    });
  }

  const row = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ?"
    )
    .get(subscriptionId, companyId)) as CustomerSubscription;
  return NextResponse.json(row, { status: 201 });
}
