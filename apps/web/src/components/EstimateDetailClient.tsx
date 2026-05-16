"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Estimate = {
  id: number;
  customer_id: number;
  notes: string | null;
  status: string;
  total_cents: number;
  lead_source: string | null;
  sold_by_id: number | null;
  sold_by_name: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  items: {
    id: number;
    title: string;
    description: string | null;
    quantity: number;
    price_cents: number;
  }[];
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function EstimateDetailClient({ id }: { id: number }) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/estimates/${id}`);
    if (!res.ok) {
      setError("Estimate not found");
      setLoading(false);
      return;
    }
    const est = (await res.json()) as Estimate;
    setEstimate(est);
    const cRes = await fetch(`/api/customers/${est.customer_id}`);
    if (cRes.ok) {
      const j = await cRes.json();
      setCustomer(j.customer as Customer);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this estimate?")) return;
    const res = await fetch(`/api/estimates/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  }

  async function markAccepted() {
    const res = await fetch(`/api/estimates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    if (res.ok) await reload();
  }

  if (loading) {
    return <div className="text-sm text-zinc-400">Loading…</div>;
  }
  if (error || !estimate) {
    return <div className="text-sm text-rose-400">{error || "Not found"}</div>;
  }

  const isAccepted = estimate.status === "accepted";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-white">
            Estimate #{estimate.id}
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-bold capitalize">
            {estimate.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowSend(true)}
            className="h-auto inline-flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold shadow-sm"
          >
            Send Estimate
          </Button>
          {!isAccepted && (
            <Button
              type="button"
              variant="ghost"
              onClick={markAccepted}
              className="h-auto inline-flex items-center gap-1.5 border border-line bg-card hover:bg-black text-white rounded-full px-5 py-2.5 text-sm font-bold"
            >
              Mark Accepted
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="h-auto inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 rounded-full px-3 py-2 text-sm font-bold"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Customer
              </h2>
            </CardHeader>
            {customer ? (
              <div className="space-y-1 text-sm">
                <Link
                  href={`/customers/${customer.id}`}
                  className="font-bold text-white tracking-tight hover:underline"
                >
                  {customer.name}
                </Link>
                {customer.phone && (
                  <div className="text-zinc-400">{customer.phone}</div>
                )}
                {customer.email && (
                  <div className="text-zinc-400">{customer.email}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">—</div>
            )}
          </Card>

          {(estimate.sold_by_name || estimate.lead_source) && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Lead Source
                </h2>
              </CardHeader>
              <div className="space-y-1 text-sm">
                {estimate.sold_by_name && (
                  <div className="text-zinc-200 font-bold">
                    {estimate.sold_by_name}
                  </div>
                )}
                {estimate.lead_source && (
                  <div className="text-zinc-400 font-bold">
                    {estimate.lead_source}
                  </div>
                )}
              </div>
            </Card>
          )}

          {estimate.notes && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Private Notes
                </h2>
              </CardHeader>
              <div className="text-sm text-zinc-200 whitespace-pre-wrap">
                {estimate.notes}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Line Items
              </h2>
            </CardHeader>
            <ul className="space-y-3">
              {estimate.items.map((it) => (
                <li
                  key={it.id}
                  className="rounded-xl border border-line p-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white tracking-tight">
                        {it.title}
                      </div>
                      {it.description && (
                        <div className="text-xs text-zinc-400 mt-1">
                          {it.description}
                        </div>
                      )}
                      <div className="text-xs text-zinc-500 mt-1">
                        {it.quantity} × {formatPrice(it.price_cents)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-white tracking-tight">
                      {formatPrice(
                        Math.round(it.quantity * it.price_cents)
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-3 flex items-center justify-between">
              <div className="text-base font-extrabold text-white tracking-tight">
                Total
              </div>
              <div className="text-base font-extrabold text-white tracking-tight">
                {formatPrice(estimate.total_cents)}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {showSend && customer && (
        <SendEstimateDialog
          estimate={estimate}
          customer={customer}
          onClose={() => setShowSend(false)}
          onSent={async () => {
            setShowSend(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-5 shadow-sm">
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      {children}
    </div>
  );
}

function SendEstimateDialog({
  estimate,
  customer,
  onClose,
  onSent,
}: {
  estimate: Estimate;
  customer: Customer;
  onClose: () => void;
  onSent: () => void | Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setErr(null);
    const res = await fetch(`/api/estimates/${estimate.id}/send`, {
      method: "POST",
    });
    setSending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not send estimate");
      return;
    }
    await onSent();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview &amp; Send Estimate</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-line bg-black p-5 max-h-[60vh] overflow-y-auto">
          <div className="text-xl font-extrabold tracking-tight text-white mb-1">
            Estimate
          </div>
          <div className="text-sm text-zinc-400 mb-4">Number: {estimate.id}</div>
          <div className="text-sm font-bold text-white">{customer.name}</div>
          {customer.phone && (
            <div className="text-xs text-zinc-400">{customer.phone}</div>
          )}
          {customer.email && (
            <div className="text-xs text-zinc-400">{customer.email}</div>
          )}

          <div className="mt-5 border-t border-line pt-3">
            <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-xs font-bold text-zinc-500 pb-2 border-b border-line">
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div className="text-right">Amount</div>
            </div>
            {estimate.items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-sm py-2 border-b border-line/40"
              >
                <div>
                  <div className="text-white font-bold">{it.title}</div>
                  {it.description && (
                    <div className="text-xs text-zinc-400">{it.description}</div>
                  )}
                </div>
                <div className="text-right text-zinc-200">{it.quantity}</div>
                <div className="text-right text-zinc-200">
                  {formatPrice(it.price_cents)}
                </div>
                <div className="text-right text-white font-bold">
                  {formatPrice(Math.round(it.quantity * it.price_cents))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-zinc-400">Total</div>
              <div className="text-sm font-extrabold text-white">
                {formatPrice(estimate.total_cents)}
              </div>
            </div>
          </div>
        </div>
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-auto border border-line bg-card hover:bg-black text-white rounded-full px-5 py-2 text-sm font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={send}
            disabled={sending}
            className="h-auto bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 text-sm font-bold"
          >
            {sending ? "Sending…" : "Send Estimate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
