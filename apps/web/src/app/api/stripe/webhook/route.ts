import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, syncAccountStatus } from "@/lib/stripe";
import { getDb, type Invoice } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Handles both platform-level and Connect-relayed
 * events:
 *   - account.updated (platform):     refresh cached capability flags
 *   - checkout.session.completed (Connect): mark invoice paid
 *
 * Configure in Stripe dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<your-app>/api/stripe/webhook
 *   Events: account.updated, checkout.session.completed
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
    // Log the underlying detail (Stripe SDK errors mention secret/sig hints
    // we don't want to echo to the client), return only a generic message.
    console.error("Stripe webhook signature verification failed:", e);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
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
      await syncAccountStatus(account.id, account);
    } else if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event);
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
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE id = ?")
    .get(invoiceId)) as Invoice | undefined;
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
       WHERE id = ?`
    )
    .run(paymentIntentId, invoiceId);
}
