import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  syncAccountStatus,
  getCompanyByStripeAccount,
  savePaymentMethodForCustomer,
} from "@/lib/stripe";
import { getDb, type Invoice } from "@/lib/db";

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
 *
 * Configure in Stripe dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<your-app>/api/stripe/webhook
 *   Events: account.updated, checkout.session.completed,
 *           payment_intent.succeeded, setup_intent.succeeded
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
