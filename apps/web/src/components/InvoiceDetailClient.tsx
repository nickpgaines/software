"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Invoice = {
  id: number;
  customer_id: number;
  notes: string | null;
  status: string;
  total_cents: number;
  paid_cents: number;
  lead_source: string | null;
  payment_method: string | null;
  sent_at: string | null;
  paid_at: string | null;
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

const PAYMENT_METHODS = [
  { value: "card_manual", label: "Credit Card (manual)" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

export default function InvoiceDetailClient({ id }: { id: number }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) {
      setError("Invoice not found");
      setLoading(false);
      return;
    }
    const inv = (await res.json()) as Invoice;
    setInvoice(inv);
    const cRes = await fetch(`/api/customers/${inv.customer_id}`);
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
    if (!confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  }

  if (loading) {
    return <div className="text-sm text-zinc-400">Loading…</div>;
  }
  if (error || !invoice) {
    return <div className="text-sm text-rose-400">{error || "Not found"}</div>;
  }

  const amountDue = Math.max(0, invoice.total_cents - invoice.paid_cents);
  const isPaid = invoice.status === "paid";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-white">Invoice #{invoice.id}</h1>
          <p className="text-sm text-zinc-400 mt-2 font-bold capitalize">
            {invoice.status}
            {isPaid && invoice.payment_method
              ? ` · ${labelForMethod(invoice.payment_method)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowSend(true)}
            className="h-auto inline-flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold shadow-sm"
          >
            Send Invoice
          </Button>
          {!isPaid && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowMarkPaid(true)}
              className="h-auto inline-flex items-center gap-1.5 border border-line bg-card hover:bg-black text-white rounded-full px-5 py-2.5 text-sm font-bold"
            >
              Mark Paid
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

          {invoice.lead_source && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Lead Source
                </h2>
              </CardHeader>
              <div className="text-sm text-zinc-200 font-bold">
                {invoice.lead_source}
              </div>
            </Card>
          )}

          {invoice.notes && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Private Notes
                </h2>
              </CardHeader>
              <div className="text-sm text-zinc-200 whitespace-pre-wrap">
                {invoice.notes}
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
              {invoice.items.map((it) => (
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
                {formatPrice(invoice.total_cents)}
              </div>
            </div>
            {invoice.paid_cents > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="text-zinc-400">Paid</div>
                <div className="font-bold text-emerald-400">
                  {formatPrice(invoice.paid_cents)}
                </div>
              </div>
            )}
            {!isPaid && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="text-zinc-400">Amount Due</div>
                <div className="font-bold text-white">
                  {formatPrice(amountDue)}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {showSend && customer && (
        <SendInvoiceDialog
          invoice={invoice}
          customer={customer}
          onClose={() => setShowSend(false)}
          onSent={async () => {
            setShowSend(false);
            await reload();
          }}
        />
      )}

      {showMarkPaid && (
        <MarkPaidDialog
          invoice={invoice}
          onClose={() => setShowMarkPaid(false)}
          onPaid={async () => {
            setShowMarkPaid(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function labelForMethod(method: string) {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
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

function SendInvoiceDialog({
  invoice,
  customer,
  onClose,
  onSent,
}: {
  invoice: Invoice;
  customer: Customer;
  onClose: () => void;
  onSent: () => void | Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setErr(null);
    const res = await fetch(`/api/invoices/${invoice.id}/send`, {
      method: "POST",
    });
    setSending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not send invoice");
      return;
    }
    await onSent();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview &amp; Send Invoice</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-line bg-black p-5 max-h-[60vh] overflow-y-auto">
          <div className="text-xl font-extrabold tracking-tight text-white mb-1">
            Invoice
          </div>
          <div className="text-sm text-zinc-400">Number: {invoice.id}</div>
          <div className="text-sm text-zinc-400 mb-4">
            Due: Upon receipt
          </div>
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
            {invoice.items.map((it) => (
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
                {formatPrice(invoice.total_cents)}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <div className="text-sm text-zinc-400">Amount Due</div>
              <div className="text-sm font-extrabold text-white">
                {formatPrice(
                  Math.max(0, invoice.total_cents - invoice.paid_cents)
                )}
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
            {sending ? "Sending…" : "Send Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidDialog({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: Invoice;
  onClose: () => void;
  onPaid: () => void | Promise<void>;
}) {
  const due = Math.max(0, invoice.total_cents - invoice.paid_cents);
  const [method, setMethod] = useState<string>("card_manual");
  const [amount, setAmount] = useState<string>((due / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const cents = Math.max(0, Math.round((parseFloat(amount) || 0) * 100));
    if (cents <= 0) {
      setErr("Amount must be greater than 0");
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paid",
        paid_cents: cents,
        payment_method: method,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not mark paid");
      return;
    }
    await onPaid();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-2">
              Payment Method
            </Label>
            {/* Native <select> kept: empty-string sentinel pattern */}
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-line rounded-xl px-4 py-2 text-sm bg-card"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="block text-xs font-bold text-zinc-500 mb-2">
              Amount (USD)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-auto w-full border-line rounded-xl px-4 py-2 text-sm bg-card"
            />
          </div>
          {err && <p className="text-sm text-rose-400">{err}</p>}
        </div>
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
            onClick={save}
            disabled={saving}
            className="h-auto bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 text-sm font-bold"
          >
            {saving ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
