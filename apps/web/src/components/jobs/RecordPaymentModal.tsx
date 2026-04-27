"use client";

import { useMemo, useState } from "react";

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

  const amountNumber = useMemo(() => Number(amount), [amount]);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const tipNumber = useMemo(() => Number(tip || "0"), [tip]);
  const tipValid = Number.isFinite(tipNumber) && tipNumber >= 0;

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Record payment</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-full pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  autoFocus
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                Tip
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="w-full border border-slate-200 rounded-full pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1.5">
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
                        ? "bg-cyan-500 border-cyan-500 text-white"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50")
                    }
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm"
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
              className="text-sm border border-slate-200 bg-white hover:bg-slate-50 rounded-full px-4 py-2 text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !amountValid}
              className="text-sm bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-300 text-white rounded-full px-5 py-2 font-medium"
            >
              {saving ? "Recording…" : "Record payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="border border-slate-200 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-700">{label}</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
          className={
            "relative w-10 h-6 rounded-full transition shrink-0 " +
            (enabled ? "bg-cyan-500" : "bg-slate-200")
          }
        >
          <span
            className={
              "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition " +
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
          className="mt-2 w-full border border-slate-200 bg-slate-50 rounded-full px-3 py-1.5 text-sm text-slate-600"
        />
      )}
    </div>
  );
}
