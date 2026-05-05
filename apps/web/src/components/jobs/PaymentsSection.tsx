"use client";

import { useState } from "react";
import RecordPaymentModal from "@/components/jobs/RecordPaymentModal";
import { Button } from "@/components/ui/button";

export type PaymentsSectionPayment = {
  id: number;
  amount_cents: number;
  tip_cents: number;
  method: string;
  payment_date: string;
  notes: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  check: "Check",
  e_transfer: "E-transfer",
  other: "Other",
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string, mounted: boolean) {
  if (!mounted) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PaymentsSection({
  jobId,
  jobTotalCents,
  paidTotalCents,
  customerEmail,
  customerPhone,
  payments,
  onChanged,
}: {
  jobId: number;
  jobTotalCents: number;
  paidTotalCents: number;
  customerEmail: string | null;
  customerPhone: string | null;
  payments: PaymentsSectionPayment[];
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (typeof window !== "undefined" && !mounted) {
    queueMicrotask(() => setMounted(true));
  }

  async function deletePayment(id: number) {
    if (!confirm("Delete this payment record?")) return;
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">Payments</h2>
        {payments.length > 0 && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-auto text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-1.5 font-bold"
          >
            Record payment
          </Button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-400 font-bold">No payments recorded yet.</p>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-auto mt-3 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-2 font-bold"
          >
            Record payment
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {payments.map((p) => (
            <li
              key={p.id}
              className="py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-white">
                  <span
                    className="font-bold tabular-nums"
                    suppressHydrationWarning
                  >
                    {formatDate(p.payment_date, mounted)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-black text-zinc-400">
                    {METHOD_LABELS[p.method] || p.method}
                  </span>
                </div>
                {p.notes && (
                  <div className="text-xs text-zinc-400 mt-0.5 break-words">
                    {p.notes}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-extrabold text-white tracking-tight tabular-nums">
                    {money(p.amount_cents)}
                  </div>
                  {p.tip_cents > 0 && (
                    <div className="text-xs text-emerald-600 tabular-nums">
                      + {money(p.tip_cents)} tip
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => deletePayment(p.id)}
                  className="h-auto p-0 text-eyebrow uppercase text-zinc-500 hover:text-rose-600 hover:bg-transparent"
                  aria-label="Delete payment"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <RecordPaymentModal
          jobId={jobId}
          jobTotalCents={jobTotalCents}
          paidTotalCents={paidTotalCents}
          customerEmail={customerEmail}
          customerPhone={customerPhone}
          onClose={() => setModalOpen(false)}
          onRecorded={() => {
            setModalOpen(false);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
