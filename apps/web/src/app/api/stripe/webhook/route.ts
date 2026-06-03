import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  syncAccountStatus,
  getCompanyByStripeAccount,
  savePaymentMethodForCustomer,
} from "@/lib/stripe";
import {
  getDb,
  type Invoice,
  type CustomerSubscription,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Handles both platform-level and Connect-relayed
 * events:
 *   - account.updated (platform):     refresh cached capability flags
 *   - checkout.session.completed (Connect): mark invoice paid
 *   - payment_intent.succeeded (Connect): mark invoice paid for inline
 *       PaymentElement / Apple Pay / Google Pay flow (no Checkout
 *       redirect to deliver session.completed)
 *   - setup_intent.succeeded (Connect): persist a saved card-on-file
 *       so the PWA UI sees it immediately even if the client-side save
 *       call hasn't landed yet
 *   - customer.subscription.updated (Connect): mirror Stripe Sub state
 *       changes (status, pause, cancel) onto the linked Forge row
 *   - customer.subscription.deleted (Connect): mark the linked Forge row
 *       canceled when Stripe ends the subscription
 *   - invoice.payment_succeeded (Connect): record a Forge Payment row for
 *       each successful subscription charge so it shows in customer history
 *   - invoice.payment_failed (Connect): flip the linked Forge row to
 *       past_due so the UI surfaces it (Stripe handles retry/dunning itself)
 *
 * Configure in Stripe dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<your-app>/api/stripe/webhook
 *   Events: account.updated, checkout.session.completed,
 *           payment_intent.succeeded, setup_intent.succeeded,
 *           customer.subscription.updated, customer.subscription.deleted,
 *           invoice.payment_succeeded, invoice.payment_failed
 *   ✓ Listen to events on Connected accounts
 * Drop the signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  // Idempotency: Stripe sometimes redelivers the same event (network retries,
  // resends from the dashboard). Try to claim this event_id atomically; if the
  // INSERT was a no-op (already present), we've handled it before — ack and skip.
  const db = await getDb();
  try {
    const claim = await db
      .prepare(
        "INSERT OR IGNORE INTO stripe_webhook_events (event_id, type) VALUES (?, ?)"
      )
      .run(event.id, event.type);
    if (Number(claim.changes ?? 0) === 0) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (e) {
    console.error("Webhook idempotency check failed:", e);
    // Fall through — better to risk a duplicate than to drop the event silently.
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      // Resolve which tenant owns this connected account before writing.
      const company = await getCompanyByStripeAccount(account.id);
      if (company) {
        await syncAccountStatus(company.id, account.id, account);
      }
    } else if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event);
    } else if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntentSucceeded(event);
    } else if (event.type === "setup_intent.succeeded") {
      await handleSetupIntentSucceeded(event);
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionLifecycle(event);
    } else if (event.type === "invoice.payment_succeeded") {
      await handleSubscriptionInvoicePaid(event);
    } else if (event.type === "invoice.payment_failed") {
      await handleSubscriptionInvoiceFailed(event);
    }
  } catch (e) {
    console.error("Webhook handler failed:", e);
    // Roll back the idempotency claim so Stripe's retry can re-attempt.
    try {
      await db
        .prepare("DELETE FROM stripe_webhook_events WHERE event_id = ?")
        .run(event.id);
    } catch {}
    return NextResponse.json(
      { error: "Handler error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  // Only process invoice payments (sessions we minted carry invoice_id
  // in metadata). Sessions for other purposes can be added later.
  const invoiceIdRaw = session.metadata?.invoice_id;
  if (!invoiceIdRaw) return;
  const invoiceId = Number(invoiceIdRaw);
  if (!Number.isFinite(invoiceId)) return;

  // Stripe only signals "completed" when payment_status === "paid".
  // Handle the rare async case (delayed bank methods) by checking it.
  if (session.payment_status !== "paid") return;

  const db = await getDb();
  // Identify the tenant via the connected account this Connect-relayed
  // event arrived from. event.account is set on Connect events.
  const connectedAccountId =
    typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) return;
  const company = await getCompanyByStripeAccount(connectedAccountId);
  if (!company) return;

  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(invoiceId, company.id)) as Invoice | undefined;
  if (!invoice) return;
  if (invoice.status === "paid") return; // idempotent

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  await db
    .prepare(
      `UPDATE invoices
         SET status = 'paid',
             paid_cents = total_cents,
             paid_at = datetime('now'),
             stripe_payment_intent_id = ?,
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(paymentIntentId, invoiceId, company.id);
}

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent;
  // Only reconcile invoice payments here. Job/RecordPayment flows record
  // their own row via /api/jobs/[id]/payments/stripe-confirm, and the
  // subscription off-session charge writes its own Payment row, so we
  // intentionally don't double-write here.
  const invoiceIdRaw = intent.metadata?.invoice_id;
  if (!invoiceIdRaw) return;
  const invoiceId = Number(invoiceIdRaw);
  if (!Number.isFinite(invoiceId)) return;

  const connectedAccountId =
    typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) return;
  const company = await getCompanyByStripeAccount(connectedAccountId);
  if (!company) return;

  const db = await getDb();
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ? AND company_id = ?")
    .get(invoiceId, company.id)) as Invoice | undefined;
  if (!invoice) return;
  if (invoice.status === "paid") return;

  await db
    .prepare(
      `UPDATE invoices
         SET status = 'paid',
             paid_cents = total_cents,
             paid_at = datetime('now'),
             stripe_payment_intent_id = ?,
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(intent.id, invoiceId, company.id);
}

// Stripe SDK v22 moved subscription + payment_intent off the top-level Invoice
// object and onto nested structures. These helpers paper over the change so
// the handler reads the same fields regardless of API era. (Both new and old
// shapes are tolerated because Stripe's wire format may still send either for
// some events depending on API version negotiation.)
function getInvoiceSubscriptionId(
  invoice: Stripe.Invoice
): string | null {
  const legacy = (invoice as unknown as { subscription?: string | Stripe.Subscription })
    .subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object" && "id" in fromParent)
    return fromParent.id;
  return null;
}

function getInvoicePaymentIntentId(
  invoice: Stripe.Invoice
): string | null {
  const legacy = (
    invoice as unknown as { payment_intent?: string | Stripe.PaymentIntent }
  ).payment_intent;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  const first = invoice.payments?.data?.[0]?.payment?.payment_intent;
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "id" in first) return first.id;
  return null;
}

async function handleSubscriptionLifecycle(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const connectedAccountId =
    typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) return;
  const company = await getCompanyByStripeAccount(connectedAccountId);
  if (!company) return;
  const db = await getDb();

  const row = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ? AND stripe_subscription_id = ?
        LIMIT 1`
    )
    .get(company.id, sub.id)) as CustomerSubscription | undefined;
  if (!row) return;

  // Stripe's status is canonical; mirror it. When it transitions to canceled
  // (either via cancel or deleted), also flip the Forge agreement status.
  const isCanceled =
    sub.status === "canceled" || event.type === "customer.subscription.deleted";

  if (isCanceled) {
    await db
      .prepare(
        `UPDATE customer_subscriptions
           SET stripe_subscription_status = 'canceled',
               status = CASE WHEN status IN ('canceled') THEN status ELSE 'canceled' END,
               canceled_at = COALESCE(canceled_at, datetime('now'))
         WHERE id = ? AND company_id = ?`
      )
      .run(row.id, company.id);
    return;
  }

  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET stripe_subscription_status = ?,
             billing_status = CASE WHEN ? = 'past_due' THEN 'past_due' ELSE billing_status END
       WHERE id = ? AND company_id = ?`
    )
    .run(sub.status, sub.status, row.id, company.id);
}

async function handleSubscriptionInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return; // Not a subscription invoice — ignore.

  const connectedAccountId =
    typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) return;
  const company = await getCompanyByStripeAccount(connectedAccountId);
  if (!company) return;
  const db = await getDb();

  const row = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ? AND stripe_subscription_id = ?
        LIMIT 1`
    )
    .get(company.id, subscriptionId)) as CustomerSubscription | undefined;
  if (!row) return;

  const paymentIntentId = getInvoicePaymentIntentId(invoice);

  // Insert a Payment row for this charge unless we've already recorded the
  // same PaymentIntent (Stripe retries can replay invoice.payment_succeeded).
  if (paymentIntentId) {
    const existing = (await db
      .prepare(
        `SELECT id FROM payments
          WHERE company_id = ? AND stripe_payment_intent_id = ?
          LIMIT 1`
      )
      .get(company.id, paymentIntentId)) as { id: number } | undefined;
    if (existing) {
      // Still update sub health below — but don't double-insert.
    } else {
      const amount = invoice.amount_paid || invoice.amount_due || 0;
      const paymentDate = new Date().toISOString().slice(0, 10);
      await db
        .prepare(
          `INSERT INTO payments
             (company_id, job_id, amount_cents, tip_cents, method, payment_date,
              notes, send_email, send_sms, stripe_payment_intent_id, source,
              subscription_id)
           VALUES (?, NULL, ?, 0, 'card', ?, ?, 0, 0, ?, 'subscription', ?)`
        )
        .run(
          company.id,
          amount,
          paymentDate,
          `Subscription #${row.id} charge (Stripe invoice ${invoice.id})`,
          paymentIntentId,
          row.id
        );
    }
  }

  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET last_charged_at = datetime('now'),
             billing_status = 'current',
             failed_charge_count = 0,
             last_charge_error = NULL,
             stripe_subscription_status = COALESCE(stripe_subscription_status, 'active')
       WHERE id = ? AND company_id = ?`
    )
    .run(row.id, company.id);
}

async function handleSubscriptionInvoiceFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const connectedAccountId =
    typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) return;
  const company = await getCompanyByStripeAccount(connectedAccountId);
  if (!company) return;
  const db = await getDb();

  const row = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ? AND stripe_subscription_id = ?
        LIMIT 1`
    )
    .get(company.id, subscriptionId)) as CustomerSubscription | undefined;
  if (!row) return;

  const reason =
    (invoice.last_finalization_error?.message as string | undefined) ||
    "Card was declined";

  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET billing_status = 'past_due',
             failed_charge_count = failed_charge_count + 1,
             last_charge_error = ?,
             last_charge_attempt_at = datetime('now'),
             stripe_subscription_status = 'past_due'
       WHERE id = ? AND company_id = ?`
    )
    .run(reason, row.id, company.id);
}

async function handleSetupIntentSucceeded(event: Stripe.Event) {
  const si = event.data.object as Stripe.SetupIntent;
  const companyIdRaw = si.metadata?.company_id;
  const customerIdRaw = si.metadata?.customer_id;
  if (!companyIdRaw || !customerIdRaw) return;
  const companyId = Number(companyIdRaw);
  const customerId = Number(customerIdRaw);
  if (!Number.isFinite(companyId) || !Number.isFinite(customerId)) return;

  const connectedAccountId =
    typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) return;
  const company = await getCompanyByStripeAccount(connectedAccountId);
  if (!company || company.id !== companyId) return;

  const pmId =
    typeof si.payment_method === "string"
      ? si.payment_method
      : si.payment_method?.id;
  if (!pmId) return;

  // The accept page already calls PUT /setup-intent which saves the PM
  // on the server. This is the safety net for cases where the network
  // dropped between confirmSetup and our save call.
  try {
    await savePaymentMethodForCustomer({
      companyId,
      customerId,
      stripeAccountId: connectedAccountId,
      stripePaymentMethodId: pmId,
      makeDefault: false,
    });
  } catch (e) {
    console.warn("Webhook: could not save payment method:", e);
  }
}
