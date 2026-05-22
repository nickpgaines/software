"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";

// One Stripe instance per connected account (Connect direct charges
// require the `stripeAccount` option to be set on loadStripe).
const _connectStripeCache = new Map<string, Promise<StripeJs | null>>();
function stripePromise(stripeAccount: string | null) {
  if (!PUBLISHABLE_KEY) return null;
  const key = stripeAccount || "_platform_";
  if (!_connectStripeCache.has(key)) {
    _connectStripeCache.set(
      key,
      loadStripe(PUBLISHABLE_KEY, stripeAccount ? { stripeAccount } : undefined)
    );
  }
  return _connectStripeCache.get(key)!;
}

type IntentPayload = {
  client_secret: string;
  payment_intent_id: string;
  stripe_account: string;
  amount_cents: number;
};

export default function PayClient({
  token,
  cancelled,
}: {
  token: string;
  cancelled: boolean;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentPayload | null>(null);

  const stripeReady = Boolean(PUBLISHABLE_KEY);

  // Mint the inline PaymentIntent on mount. The PaymentElement renders
  // Apple Pay / Google Pay buttons automatically when the customer's
  // device supports them — that's our "tap to pay" UX in the PWA.
  useEffect(() => {
    if (!stripeReady) return;
    let cancelledLocal = false;
    setError(null);
    fetch(`/api/invoices/pay/${token}/payment-intent`, { method: "POST" })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as Partial<
          IntentPayload & { error?: string }
        >;
        if (cancelledLocal) return;
        if (!r.ok || !data.client_secret || !data.payment_intent_id) {
          setError(data.error || `Could not start payment (HTTP ${r.status})`);
          return;
        }
        setIntent({
          client_secret: data.client_secret,
          payment_intent_id: data.payment_intent_id,
          stripe_account: data.stripe_account || "",
          amount_cents: data.amount_cents || 0,
        });
      })
      .catch((e) => {
        if (!cancelledLocal) {
          setError(e instanceof Error ? e.message : "Could not start payment");
        }
      });
    return () => {
      cancelledLocal = true;
    };
  }, [token, stripeReady]);

  async function openHostedCheckout() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/invoices/pay/${token}/checkout-session`,
        { method: "POST" }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || `Could not start payment (HTTP ${res.status})`);
        setWorking(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment");
      setWorking(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {cancelled && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Payment was cancelled. Try again whenever you&apos;re ready.
        </div>
      )}

      {stripeReady && intent && (
        <Elements
          stripe={stripePromise(intent.stripe_account || null)}
          options={{
            clientSecret: intent.client_secret,
            appearance: { theme: "night" },
          }}
        >
          <InlinePay token={token} />
        </Elements>
      )}

      {!stripeReady && (
        <Button
          type="button"
          variant="ghost"
          onClick={openHostedCheckout}
          disabled={working}
          className="w-full h-auto bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-3 text-sm font-bold"
        >
          {working ? "Opening checkout…" : "Pay with card"}
        </Button>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {stripeReady && intent && (
        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            onClick={openHostedCheckout}
            disabled={working}
            className="text-xs text-zinc-400 hover:text-white hover:bg-transparent h-auto p-0 underline"
          >
            {working
              ? "Opening checkout…"
              : "Or pay on Stripe's hosted checkout"}
          </Button>
        </div>
      )}
    </div>
  );
}

function InlinePay({ token }: { token: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("status", "success");
    return url.toString();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      // PaymentElement handles its own redirect when needed (Apple Pay
      // doesn't redirect; bank-debit methods might). Tell it to redirect
      // only when required so we land back on this page on the happy path.
      redirect: "if_required",
    });
    if (confirmError) {
      setSubmitting(false);
      setError(confirmError.message || "Payment was declined");
      return;
    }
    // Happy path: PaymentIntent succeeded, no redirect — bounce to the
    // ?status=success view so the server page renders the receipt. The
    // webhook flips the invoice to paid (idempotent on refresh).
    window.location.href = `/invoices/pay/${token}?status=success`;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs" }}
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button
        type="submit"
        variant="ghost"
        disabled={!stripe || !elements || !ready || submitting}
        className="w-full h-auto bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-3 text-sm font-bold"
      >
        {submitting ? "Processing…" : "Pay now"}
      </Button>
    </form>
  );
}
