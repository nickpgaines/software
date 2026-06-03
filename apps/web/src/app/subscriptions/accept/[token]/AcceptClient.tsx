"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerSubscription } from "@/lib/db";

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";

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

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateLabel(dateInput: string | null) {
  if (!dateInput) return "today";
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? (() => {
        const [y, m, d] = dateInput.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      })()
    : new Date(dateInput);
  if (isNaN(dt.getTime())) return dateInput;
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type SetupIntentInfo = {
  client_secret: string;
  setup_intent_id: string;
  stripe_account: string;
};

export default function AcceptClient({
  subscription,
  customerName,
  serviceAddress,
  companyName,
  visitsPerYear,
  monthlyEquivalentCents,
  intervalLabel,
  servicePeriod,
  billingPeriod,
}: {
  subscription: CustomerSubscription;
  customerName: string;
  serviceAddress: string | null;
  companyName: string;
  visitsPerYear: number;
  monthlyEquivalentCents: number;
  intervalLabel: string;
  servicePeriod: string;
  billingPeriod: string;
}) {
  const router = useRouter();
  const requireSignature = subscription.require_signature === 1;
  const alreadyAccepted = subscription.status !== "pending";

  const [setupIntent, setSetupIntent] = useState<SetupIntentInfo | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Mint the SetupIntent on mount so the card form renders alongside the
  // signature pad — single page, single submit. If this fails (Stripe not
  // configured on the merchant, etc.) we surface the error in place of the
  // card form so the customer isn't lied to about their card being saved.
  useEffect(() => {
    if (subscription.status === "canceled" || subscription.status === "declined") {
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetch(
        `/api/subscriptions/accept/${subscription.accept_token}/setup-intent`,
        { method: "POST" }
      );
      const data = (await r.json().catch(() => ({}))) as Partial<{
        client_secret: string;
        setup_intent_id: string;
        stripe_account: string;
        error: string;
      }>;
      if (cancelled) return;
      if (!r.ok || !data.client_secret || !data.setup_intent_id) {
        setSetupError(
          data.error ||
            "We couldn't reach payments right now. Please contact us so we can finish setting up your card."
        );
        return;
      }
      setSetupIntent({
        client_secret: data.client_secret,
        setup_intent_id: data.setup_intent_id,
        stripe_account: data.stripe_account || "",
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const billedMonthly =
    subscription.interval === "monthly" &&
    subscription.service_interval !== "monthly";
  const billingSummary = billedMonthly
    ? `${formatPrice(subscription.price_cents)} per ${servicePeriod}, billed monthly at ~${formatPrice(monthlyEquivalentCents)}/mo`
    : `${formatPrice(subscription.price_cents)} per ${servicePeriod}, billed every ${billingPeriod}`;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-bold text-zinc-500">{companyName}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {subscription.name}
          </h1>
          <p className="text-sm text-zinc-400 font-bold">
            Hi {customerName.split(" ")[0]}, here&apos;s the subscription
            agreement to review and sign.
          </p>
        </header>

        {subscription.description && (
          <section className="rounded-2xl border border-line bg-card p-5">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">
              {subscription.description}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-card p-5 space-y-3">
          <h2 className="text-base font-extrabold tracking-tight">
            Plan summary
          </h2>
          <dl className="divide-y divide-line rounded-xl border border-line text-sm">
            <SummaryRow
              label="Service"
              value={`${intervalLabel} (${visitsPerYear} visits per year)`}
            />
            <SummaryRow
              label="Duration"
              value={`Starting ${formatDateLabel(
                subscription.start_date
              )} · ongoing until canceled`}
            />
            {serviceAddress && (
              <SummaryRow label="Service address" value={serviceAddress} />
            )}
            <SummaryRow label="Billing" value={billingSummary} />
          </dl>
          <p className="text-xs text-zinc-500">
            Per-visit price:{" "}
            <span className="font-bold text-zinc-300">
              {formatPrice(subscription.price_cents)}
            </span>{" "}
            · this is the value of each visit, regardless of billing cadence.
          </p>
        </section>

        {subscription.terms_snapshot && (
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="text-base font-extrabold tracking-tight mb-2">
              Terms
            </h2>
            <div className="text-xs text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-wrap">
              {subscription.terms_snapshot}
            </div>
          </section>
        )}

        {done ? (
          <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
            Thanks {customerName.split(" ")[0]} — your subscription is
            active and your card is on file. {companyName} will be in touch
            about your first visit.
          </p>
        ) : setupError ? (
          <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            {setupError}
          </p>
        ) : !setupIntent ? (
          <p className="text-sm text-zinc-400">Preparing secure payment…</p>
        ) : (
          <Elements
            stripe={stripePromise(setupIntent.stripe_account || null)}
            options={{
              clientSecret: setupIntent.client_secret,
              appearance: { theme: "night" },
            }}
          >
            <AcceptForm
              token={subscription.accept_token!}
              setupIntentId={setupIntent.setup_intent_id}
              requireSignature={requireSignature && !alreadyAccepted}
              alreadyAccepted={alreadyAccepted}
              initialSignatureData={subscription.signature_data}
              initialSignatureName={subscription.signature_name}
              customerName={customerName}
              onDone={() => {
                setDone(true);
                router.refresh();
              }}
            />
          </Elements>
        )}
      </div>
    </main>
  );
}

function AcceptForm({
  token,
  setupIntentId,
  requireSignature,
  alreadyAccepted,
  initialSignatureData,
  initialSignatureName,
  customerName,
  onDone,
}: {
  token: string;
  setupIntentId: string;
  requireSignature: boolean;
  alreadyAccepted: boolean;
  initialSignatureData: string | null;
  initialSignatureName: string | null;
  customerName: string;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [signatureData, setSignatureData] = useState<string | null>(
    initialSignatureData
  );
  const [signatureName, setSignatureName] = useState(
    initialSignatureName || ""
  );
  const [paymentReady, setPaymentReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (requireSignature && !signatureData) {
      setError("Please sign before confirming.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // Step 1: confirm the SetupIntent on Stripe (collects the card details).
    const { error: confirmError, setupIntent: confirmed } =
      await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url:
            typeof window !== "undefined" ? window.location.href : "",
          payment_method_data: {
            billing_details: { name: customerName },
          },
        },
        redirect: "if_required",
      });
    if (confirmError) {
      setSubmitting(false);
      setError(confirmError.message || "Could not save card");
      return;
    }
    const paymentMethodId =
      typeof confirmed?.payment_method === "string"
        ? confirmed.payment_method
        : confirmed?.payment_method?.id || null;
    if (!paymentMethodId) {
      setSubmitting(false);
      setError(
        "Card setup completed but no payment method id was returned."
      );
      return;
    }

    // Step 2: if the agreement hasn't been accepted yet, accept it now so
    // the row flips to active and the visit schedule seeds. Skipped for
    // returning customers who already signed but didn't finish card setup.
    if (!alreadyAccepted) {
      const acceptRes = await fetch(
        `/api/subscriptions/accept/${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature_data: signatureData,
            signature_name: signatureName.trim() || null,
          }),
        }
      );
      if (!acceptRes.ok) {
        const j = await acceptRes.json().catch(() => ({}));
        setSubmitting(false);
        setError(j.error || "Could not accept the subscription.");
        return;
      }
    }

    // Step 3: save the PaymentMethod server-side + create the Stripe
    // Subscription. This is what actually starts the recurring billing.
    const saveRes = await fetch(
      `/api/subscriptions/accept/${token}/setup-intent`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup_intent_id: setupIntentId,
          payment_method_id: paymentMethodId,
        }),
      }
    );
    setSubmitting(false);
    if (!saveRes.ok) {
      const j = await saveRes.json().catch(() => ({}));
      setError(j.error || "Card was authorized but we couldn't save it.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {requireSignature && (
        <section className="rounded-2xl border border-line bg-card p-5 space-y-3">
          <h2 className="text-base font-extrabold tracking-tight">Signature</h2>
          <SignaturePad value={signatureData} onChange={setSignatureData} />
          <Label className="block text-xs font-bold text-zinc-500">
            Printed name
          </Label>
          <Input
            type="text"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder={customerName}
            className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card h-auto"
          />
        </section>
      )}

      <section className="rounded-2xl border border-line bg-card p-5 space-y-3">
        <h2 className="text-base font-extrabold tracking-tight">
          Payment details
        </h2>
        <PaymentElement
          onReady={() => setPaymentReady(true)}
          options={{
            // Hide billing-detail collection — we pass the customer's name
            // explicitly on confirmSetup, and the SetupIntent is locked to
            // card-only so address/country aren't needed.
            fields: { billingDetails: "never" },
            // No Apple/Google Pay buttons in the panel; keeps the look
            // single-field and minimal.
            wallets: { applePay: "never", googlePay: "never" },
          }}
        />
      </section>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="ghost"
        disabled={!stripe || !elements || !paymentReady || submitting}
        className="w-full h-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-full px-5 py-3 text-sm font-bold"
      >
        {submitting
          ? "Confirming…"
          : alreadyAccepted
            ? "Save card on file"
            : "Confirm subscription"}
      </Button>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-xs font-bold text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-xs text-zinc-300 text-right">{value}</dd>
    </div>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * ratio);
    c.height = Math.round(h * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    const last = lastRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastRef.current = p;
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    const c = canvasRef.current;
    if (!c) return;
    onChange(c.toDataURL("image/png"));
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="border border-line-strong rounded-xl bg-card">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="w-full h-32 touch-none cursor-crosshair"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={clear}
        className="text-xs text-zinc-400 hover:text-white hover:bg-transparent h-auto p-0"
      >
        Clear
      </Button>
      {value && (
        <p className="text-[11px] text-zinc-500">
          Signature captured. Tap clear to redo.
        </p>
      )}
    </div>
  );
}
