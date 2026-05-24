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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type SavedCard = {
  id: number;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: number;
  wallet_type: string | null;
};

export default function RecordPaymentModal({
  jobId,
  customerId,
  jobTotalCents,
  paidTotalCents,
  customerEmail,
  customerPhone,
  onClose,
  onRecorded,
}: {
  jobId: number;
  customerId: number;
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

  // Saved cards on file for this customer. When at least one exists we
  // show a chip row above the PaymentElement so the merchant can charge
  // a card without re-entering it. Picking "Use new card" falls back to
  // the on-session PaymentElement flow.
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<
    number | "new"
  >("new");

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

  // Load saved cards once the modal opens. Independent of Connect
  // status so the list shows up even before the user picks `card`.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stripe/customers/${customerId}/payment-methods`)
      .then((r) => (r.ok ? r.json() : { payment_methods: [] }))
      .then((data: { payment_methods?: SavedCard[] }) => {
        if (cancelled) return;
        const cards = data.payment_methods || [];
        setSavedCards(cards);
        const def = cards.find((c) => c.is_default) || cards[0];
        if (def) setSelectedSavedCardId(def.id);
      })
      .catch(() => {
        // Non-fatal — falls back to entering a new card.
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

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

  async function chargeSavedCard(paymentMethodId: number) {
    setSaving(true);
    const res = await fetch(
      `/api/jobs/${jobId}/payments/charge-saved-card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: Math.round(amountNumber * 100),
          tip_cents: Math.round(tipNumber * 100),
          payment_method_id: paymentMethodId,
          notes: notes.trim() || null,
          send_email: sendEmail,
          send_sms: sendSms,
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        requires_action?: boolean;
      };
      if (data.requires_action) {
        // 3DS required — fall back to on-session PaymentElement so the
        // customer can re-authenticate the card.
        setError(
          (data.error || "Card needs verification") +
            " — switching to manual entry."
        );
        setSelectedSavedCardId("new");
        await startCardPayment();
        return;
      }
      setError(data.error || "Could not charge saved card");
      return;
    }
    onRecorded();
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
      if (selectedSavedCardId !== "new") {
        await chargeSavedCard(selectedSavedCardId);
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
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-extrabold text-white tracking-tight">
            {step === "card" ? "Charge card" : "Record payment"}
          </h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto p-0 text-zinc-500 hover:text-zinc-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </Button>
        </div>

        {step === "details" && (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-xs font-bold text-zinc-500 mb-1 font-normal">
                  Amount
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border-line rounded-full pl-7 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 h-auto"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="block text-xs font-bold text-zinc-500 mb-1 font-normal">
                  Tip
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    className="w-full border-line rounded-full pl-7 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 h-auto"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-1.5 font-normal">
                Payment method
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => {
                  const active = method === m.key;
                  return (
                    <Button
                      key={m.key}
                      variant="ghost"
                      type="button"
                      onClick={() => setMethod(m.key)}
                      className={
                        "h-auto rounded-full px-3 py-1.5 text-sm border " +
                        (active
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-card border-line text-zinc-300 hover:bg-black")
                      }
                    >
                      {m.label}
                    </Button>
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

            {method === "card" && savedCards.length > 0 && (
              <div>
                <Label className="block text-xs font-bold text-zinc-500 mb-1.5 font-normal">
                  Card on file
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {savedCards.map((c) => {
                    const active = selectedSavedCardId === c.id;
                    const label = c.wallet_type
                      ? `${c.wallet_type === "apple_pay" ? "Apple Pay" : c.wallet_type === "google_pay" ? "Google Pay" : c.wallet_type} •••• ${c.last4 ?? "—"}`
                      : `${c.brand?.toUpperCase() || "Card"} •••• ${c.last4 ?? "—"}`;
                    return (
                      <Button
                        key={c.id}
                        variant="ghost"
                        type="button"
                        onClick={() => setSelectedSavedCardId(c.id)}
                        className={
                          "h-auto rounded-full px-3 py-1.5 text-sm border " +
                          (active
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-card border-line text-zinc-300 hover:bg-black")
                        }
                      >
                        {label}
                        {c.is_default ? " · default" : ""}
                      </Button>
                    );
                  })}
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setSelectedSavedCardId("new")}
                    className={
                      "h-auto rounded-full px-3 py-1.5 text-sm border " +
                      (selectedSavedCardId === "new"
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-card border-line text-zinc-300 hover:bg-black")
                    }
                  >
                    New card
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-1 font-normal">
                Notes
              </Label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
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
              <Button
                variant="ghost"
                type="button"
                onClick={onClose}
                className="h-auto text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                type="submit"
                disabled={saving || !amountValid}
                className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
              >
                {saving
                  ? method === "card"
                    ? "Starting…"
                    : "Recording…"
                  : method === "card"
                  ? "Continue to card"
                  : "Record payment"}
              </Button>
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
        <Button
          variant="ghost"
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="h-auto text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300"
        >
          Back
        </Button>
        <Button
          variant="ghost"
          type="submit"
          disabled={!stripe || !elements || !ready || submitting}
          className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
        >
          {submitting ? "Charging…" : `Charge $${(totalCents / 100).toFixed(2)}`}
        </Button>
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
    <div className="border border-line rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-300 font-bold">{label}</span>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
          className={
            "relative w-10 h-6 p-0 rounded-full shrink-0 hover:bg-transparent " +
            (enabled ? "bg-slate-900" : "bg-line")
          }
        >
          <span
            className={
              "absolute top-0.5 w-5 h-5 bg-card rounded-full shadow transition " +
              (enabled ? "left-[18px]" : "left-0.5")
            }
          />
        </Button>
      </div>
      {enabled && (
        <Input
          type="text"
          value={value || ""}
          readOnly
          placeholder={placeholder}
          className="mt-2 w-full border-line bg-black rounded-full px-3 py-1.5 text-sm text-zinc-400 font-bold h-auto"
        />
      )}
    </div>
  );
}
