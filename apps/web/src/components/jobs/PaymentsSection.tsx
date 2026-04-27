"use client";

import { useState } from "react";
import RecordPaymentModal from "@/components/jobs/RecordPaymentModal";

export type PaymentsSectionPayment = {
  id: number;
  amount_cents: number;
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
  customerEmail,
  customerPhone,
  payments,
  paidTotalCents,
  onChanged,
}: {
  jobId: number;
  jobTotalCents: number;
  customerEmail: string | null;
  customerPhone: string | null;
  payments: PaymentsSectionPayment[];
  paidTotalCents: number;
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  if (typeof window !== "undefined" && !mounted) {
    queueMicrotask(() => setMounted(true));
  }

  const balanceCents = Math.max(0, jobTotalCents - paidTotalCents);

  async function deletePayment(id: number) {
    if (!confirm("Delete this payment record?")) return;
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Payments</h2>
        {payments.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-1.5 font-medium"
          >
            Record payment
          </button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-2 font-medium"
          >
            Record payment
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((p) => (
            <li
              key={p.id}
              className="py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-slate-900">
                  <span
                    className="font-medium tabular-nums"
                    suppressHydrationWarning
                  >
                    {formatDate(p.payment_date, mounted)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {METHOD_LABELS[p.method] || p.method}
                  </span>
                </div>
                {p.notes && (
                  <div className="text-xs text-slate-500 mt-0.5 break-words">
                    {p.notes}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                  {money(p.amount_cents)}
                </span>
                <button
                  type="button"
                  onClick={() => deletePayment(p.id)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                  aria-label="Delete payment"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {payments.length > 0 && (
        <div className="border-t border-slate-100 mt-3 pt-3 flex justify-end gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Total paid
            </div>
            <div className="font-semibold text-slate-900 tabular-nums">
              {money(paidTotalCents)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Balance due
            </div>
            <div
              className={
                "text-lg font-bold tabular-nums " +
                (balanceCents > 0 ? "text-amber-600" : "text-emerald-600")
              }
            >
              {money(balanceCents)}
            </div>
          </div>
        </div>
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
