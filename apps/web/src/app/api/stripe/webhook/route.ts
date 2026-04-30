import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, syncAccountStatus } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook for the *platform* account. Listens for `account.updated`
 * so we can keep our cached charges/payouts/details flags in sync without
 * the user clicking Refresh in Settings.
 *
 * Configure in Stripe dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<your-app>/api/stripe/webhook
 *   Events: account.updated
 * Then drop the signing secret in STRIPE_WEBHOOK_SECRET.
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

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await syncAccountStatus(account.id, account);
    }
  } catch (e) {
    console.error("Webhook handler failed:", e);
    return NextResponse.json(
      { error: "Handler error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
