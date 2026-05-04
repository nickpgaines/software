"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

export type PaymentMethod =
  | "card"
  | "cash"
  | "check"
  | "e_transfer"
  | "other";

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "card", label: "Card" },
  { key: "cash", label: "Cash" },
  { key: "check", label: "Check" },
  { key: "e_transfer", label: "E-transfer" },
  { key: "other", label: "Other" },
];

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

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

type ConnectStatus = {
  configured: boolean;
  connected: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
};

type Step = "details" | "card";

export default function RecordPaymentModal({
  jobId,
  jobTotalCents,
  paidTotalCents,
  customerEmail,
  customerPhone,
  onClose,
  onRecorded,
}: {
  jobId: number;
  jobTotalCents: number;
  paidTotalCents: number;
  customerEmail: string | null;
  customerPhone: string | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const remainingCents = Math.max(0, jobTotalCents - paidTotalCents);

  const [amount, setAmount] = useState<string>(dollars(remainingCents));
  const [tip, setTip] = useState<string>("0.00");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("details");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [stripeAccount, setStripeAccount] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(
    null
  );

  const amountNumber = useMemo(() => Number(amount), [amount]);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const tipNumber = useMemo(() => Number(tip || "0"), [tip]);
  const tipValid = Number.isFinite(tipNumber) && tipNumber >= 0;

  const stripeReady = Boolean(PUBLISHABLE_KEY);

  useEffect(() => {
    if (method !== "card" || !stripeReady) return;
    let cancelled = false;
    fetch("/api/stripe/connect/status")
      .then((r) => r.json())
      .then((data: ConnectStatus) => {
        if (!cancelled) setConnectStatus(data);
      })
      .catch(() => {
        if (!cancelled)
          setConnectStatus({
            configured: false,
            connected: false,
            charges_enabled: false,
            details_submitted: false,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [method, stripeReady]);

  async function recordManualPayment() {
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: Math.round(amountNumber * 100),
        tip_cents: Math.round(tipNumber * 100),
        method,
        notes: notes.trim() || null,
        send_email: sendEmail,
        send_sms: sendSms,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Could not record payment");
      return;
    }
    onRecorded();
  }

  async function startCardPayment() {
    setSaving(true);
    const res = await fetch(
      `/api/jobs/${jobId}/payments/stripe-intent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: Math.round(amountNumber * 100),
          tip_cents: Math.round(tipNumber * 100),
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Could not start card payment");
      return;
    }
    const data = (await res.json()) as {
      client_secret: string;
      payment_intent_id: string;
      stripe_account: string;
    };
    setClientSecret(data.client_secret);
    setPaymentIntentId(data.payment_intent_id);
    setStripeAccount(data.stripe_account || null);
    setStep("card");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amountValid) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!tipValid) {
      setError("Tip must be zero or greater");
      return;
    }
    if (method === "card") {
      if (!stripeReady) {
        setError(
          "Stripe platform keys aren't configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY, then redeploy."
        );
        return;
      }
      if (connectStatus && !connectStatus.connected) {
        setError(
          "Connect a Stripe account in Settings → Payments before charging cards."
        );
        return;
      }
      if (connectStatus && !connectStatus.charges_enabled) {
        setError(
          "Stripe is still verifying this account. Finish onboarding in Settings → Payments before charging cards."
        );
        return;
      }
      await startCardPayment();
      return;
    }
    await recordManualPayment();
  }

  const totalCents =
    Math.round(amountNumber * 100) + Math.round(tipNumber * 100);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f0f12] rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f24]">
          <h3 className="font-extrabold text-white tracking-tight">
            {step === "card" ? "Charge card" : "Record payment"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {step === "details" && (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-[#1f1f24] rounded-full pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">
                  Tip
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    className="w-full border border-[#1f1f24] rounded-full pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
                Payment method
              </label>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => {
                  const active = method === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMethod(m.key)}
                      className={
                        "rounded-full px-3 py-1.5 text-sm border transition " +
                        (active
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-[#0f0f12] border-[#1f1f24] text-zinc-300 hover:bg-black")
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {method === "card" && !stripeReady && (
                <p className="mt-2 text-xs text-amber-600">
                  Stripe platform keys aren&apos;t configured. Add them and
                  redeploy to charge cards.
                </p>
              )}
              {method === "card" &&
                stripeReady &&
                connectStatus &&
                !connectStatus.connected && (
                  <p className="mt-2 text-xs text-amber-600">
                    No Stripe account connected.{" "}
                    <a
                      href="/settings?tab=payments"
                      className="underline font-bold"
                    >
                      Connect one in Settings
                    </a>{" "}
                    to charge cards.
                  </p>
                )}
              {method === "card" &&
                stripeReady &&
                connectStatus?.connected &&
                !connectStatus.charges_enabled && (
                  <p className="mt-2 text-xs text-amber-600">
                    Stripe is still verifying this account.{" "}
                    <a
                      href="/settings?tab=payments"
                      className="underline font-bold"
                    >
                      Finish onboarding
                    </a>{" "}
                    to charge cards.
                  </p>
                )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm"
              />
            </div>

            <ReceiptToggle
              enabled={sendEmail}
              setEnabled={setSendEmail}
              label="Send receipt by email"
              value={customerEmail}
              placeholder="No email on file"
            />
            <ReceiptToggle
              enabled={sendSms}
              setEnabled={setSendSms}
              label="Send receipt by SMS"
              value={customerPhone}
              placeholder="No phone on file"
            />

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !amountValid}
                className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
              >
                {saving
                  ? method === "card"
                    ? "Starting…"
                    : "Recording…"
                  : method === "card"
                  ? "Continue to card"
                  : "Record payment"}
              </button>
            </div>
          </form>
        )}

        {step === "card" && clientSecret && paymentIntentId && (
          <Elements
            stripe={stripePromise(stripeAccount)}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            <CardStep
              jobId={jobId}
              paymentIntentId={paymentIntentId}
              totalCents={totalCents}
              notes={notes.trim() || null}
              sendEmail={sendEmail}
              sendSms={sendSms}
              onBack={() => {
                setStep("details");
                setClientSecret(null);
                setPaymentIntentId(null);
                setStripeAccount(null);
                setError(null);
              }}
              onSuccess={onRecorded}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}

function CardStep({
  jobId,
  paymentIntentId,
  totalCents,
  notes,
  sendEmail,
  sendSms,
  onBack,
  onSuccess,
}: {
  jobId: number;
  paymentIntentId: string;
  totalCents: number;
  notes: string | null;
  sendEmail: boolean;
  sendSms: boolean;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setError(null);
  }, []);

  async function charge(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setSubmitting(false);
      setError(confirmError.message || "Card was declined");
      return;
    }

    const res = await fetch(`/api/jobs/${jobId}/payments/stripe-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_intent_id: paymentIntentId,
        notes,
        send_email: sendEmail,
        send_sms: sendSms,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data?.error ||
          "Card was charged, but recording the payment failed. Refresh and check Payments."
      );
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={charge} className="p-5 space-y-4">
      <div className="text-sm text-zinc-400 font-bold">
        Charging{" "}
        <span className="font-extrabold text-white tracking-tight">
          ${(totalCents / 100).toFixed(2)}
        </span>{" "}
        to the customer&apos;s card.
      </div>

      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs" }}
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-zinc-300 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || !ready || submitting}
          className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
        >
          {submitting ? "Charging…" : `Charge $${(totalCents / 100).toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

function ReceiptToggle({
  enabled,
  setEnabled,
  label,
  value,
  placeholder,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  label: string;
  value: string | null;
  placeholder: string;
}) {
  return (
    <div className="border border-[#1f1f24] rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-300 font-bold">{label}</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
          className={
            "relative w-10 h-6 rounded-full transition shrink-0 " +
            (enabled ? "bg-slate-900" : "bg-[#1f1f24]")
          }
        >
          <span
            className={
              "absolute top-0.5 w-5 h-5 bg-[#0f0f12] rounded-full shadow transition " +
              (enabled ? "left-[18px]" : "left-0.5")
            }
          />
        </button>
      </div>
      {enabled && (
        <input
          type="text"
          value={value || ""}
          readOnly
          placeholder={placeholder}
          className="mt-2 w-full border border-[#1f1f24] bg-black rounded-full px-3 py-1.5 text-sm text-zinc-400 font-bold"
        />
      )}
    </div>
  );
}
