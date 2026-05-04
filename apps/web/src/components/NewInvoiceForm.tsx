"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  formatted_address: string | null;
};

type Staff = { id: number; name: string; role: string | null };

type LineItem = {
  key: string;
  title: string;
  description: string;
  quantity: string;
  price: string;
  taxable: boolean;
};

type Action = "send" | "paid" | "draft";

const SERVICE_PRESETS = [
  "Window Cleaning",
  "Gutter Cleaning",
  "Pressure Washing",
  "Solar Panel Cleaning",
  "Screen Repair",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysInput(input: string, days: number) {
  const [y, m, d] = input.split("-").map(Number);
  if (!y || !m || !d) return input;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function emptyItem(): LineItem {
  return {
    key: uid(),
    title: "",
    description: "",
    quantity: "1",
    price: "",
    taxable: false,
  };
}

function priceCents(p: string) {
  return Math.max(0, Math.round((parseFloat(p) || 0) * 100));
}

function lineTotalCents(it: LineItem) {
  const qty = parseFloat(it.quantity) || 0;
  return Math.max(0, Math.round(qty * priceCents(it.price)));
}

export default function NewInvoiceForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [taxRate, setTaxRate] = useState("0");
  const [dueDate, setDueDate] = useState<string>(addDaysInput(todayInput(), 14));
  const [soldById, setSoldById] = useState<number | "">("");
  const [action, setAction] = useState<Action>("send");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    const [custRes, staffRes] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/staff"),
    ]);
    if (custRes.ok) setCustomers(await custRes.json());
    if (staffRes.ok) setStaff(await staffRes.json());
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  const subtotalCents = useMemo(
    () => items.reduce((sum, it) => sum + lineTotalCents(it), 0),
    [items]
  );
  const taxableCents = useMemo(
    () =>
      items
        .filter((it) => it.taxable)
        .reduce((sum, it) => sum + lineTotalCents(it), 0),
    [items]
  );
  const taxRateNum = Math.max(0, parseFloat(taxRate) || 0);
  const taxCents = Math.round((taxableCents * taxRateNum) / 100);
  const totalCents = subtotalCents + taxCents;

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it))
    );
  }

  function removeItem(key: string) {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((it) => it.key !== key)
    );
  }

  function addItem(preset?: string) {
    setItems((prev) => [...prev, { ...emptyItem(), title: preset ?? "" }]);
  }

  const canSubmit =
    !!customerId &&
    items.some((it) => it.title.trim()) &&
    totalCents > 0 &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      customer_id: customerId,
      title: title.trim() || null,
      notes: notes.trim() || null,
      tax_rate: taxRateNum,
      due_date: dueDate || null,
      sold_by_id: soldById || null,
      action,
      items: items
        .filter((it) => it.title.trim())
        .map((it) => ({
          title: it.title.trim(),
          description: it.description.trim() || null,
          quantity: parseFloat(it.quantity) || 1,
          price_cents: priceCents(it.price),
          taxable: it.taxable,
        })),
    };
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not create invoice");
      return;
    }
    router.push("/customers");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[40px] font-extrabold tracking-tight leading-none text-white">
            New Invoice
          </h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Bill a customer for completed work.
          </p>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2.5 text-sm font-medium shadow-sm"
        >
          <span aria-hidden>⊕</span>
          {submitting
            ? "Saving…"
            : action === "send"
              ? "Send Invoice"
              : action === "paid"
                ? "Mark Paid"
                : "Save Draft"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Customer
              </h2>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="text-sm font-medium text-zinc-300 border border-[#1f1f24] hover:bg-black rounded-full px-3 py-1.5"
              >
                + Create New Customer
              </button>
            </CardHeader>
            <CustomerPicker
              customers={customers}
              selectedId={customerId}
              query={customerQuery}
              setQuery={setCustomerQuery}
              onPick={(c) => {
                setCustomerId(c.id);
                setCustomerQuery(c.name);
              }}
              onClear={() => {
                setCustomerId(null);
                setCustomerQuery("");
              }}
            />
            {selectedCustomer && (
              <div className="text-xs text-zinc-400 mt-2">
                {selectedCustomer.formatted_address ||
                  selectedCustomer.address ||
                  "—"}
                {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Details
              </h2>
            </CardHeader>
            <Field label="Title (optional)">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="April window cleaning"
                className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12]"
                />
              </Field>
              <Field label="Sold By">
                <select
                  value={soldById}
                  onChange={(e) =>
                    setSoldById(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12]"
                >
                  <option value="">Select salesperson…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.role ? ` · ${s.role}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything the customer should know…"
                className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12]"
              />
            </Field>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Action
              </h2>
            </CardHeader>
            <div className="space-y-3">
              <RadioOption
                checked={action === "send"}
                onChange={() => setAction("send")}
                title="Send to customer"
                description="Send the invoice and notify the customer to pay."
              />
              <RadioOption
                checked={action === "paid"}
                onChange={() => setAction("paid")}
                title="Mark as paid"
                description="Record this invoice as already paid (in person, off-platform, etc.)."
              />
              <RadioOption
                checked={action === "draft"}
                onChange={() => setAction("draft")}
                title="Save as draft"
                description="Keep this invoice as a draft to send later."
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Line Items
              </h2>
              <button
                type="button"
                onClick={() => addItem()}
                className="text-sm font-medium text-zinc-300 border border-[#1f1f24] hover:bg-black rounded-full px-3 py-1.5"
              >
                + Add item
              </button>
            </CardHeader>

            <div className="flex flex-wrap gap-2 mb-3">
              {SERVICE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => addItem(p)}
                  className="text-xs bg-black hover:bg-[#1f1f24] text-zinc-300 rounded-full px-3 py-1"
                >
                  + {p}
                </button>
              ))}
            </div>

            <ul className="space-y-3">
              {items.map((it, idx) => (
                <li
                  key={it.key}
                  className="rounded-xl border border-[#1f1f24] p-3 space-y-2 bg-[#0f0f12]"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={it.title}
                      onChange={(e) =>
                        updateItem(it.key, { title: e.target.value })
                      }
                      placeholder="Item title"
                      className="flex-1 border border-[#1f1f24] rounded-lg px-3 py-2 text-sm"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="text-zinc-500 hover:text-rose-600 px-2"
                        aria-label={`Remove item ${idx + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={it.description}
                    onChange={(e) =>
                      updateItem(it.key, { description: e.target.value })
                    }
                    placeholder="Description (optional)"
                    className="w-full border border-[#1f1f24] rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(it.key, { quantity: e.target.value })
                        }
                        className="w-full border border-[#1f1f24] rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                        Price (USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.price}
                        onChange={(e) =>
                          updateItem(it.key, { price: e.target.value })
                        }
                        className="w-full border border-[#1f1f24] rounded-lg px-3 py-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                        Line total
                      </label>
                      <div className="text-sm font-bold text-white tracking-tight px-3 py-2 bg-black rounded-lg">
                        {formatPrice(lineTotalCents(it))}
                      </div>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={it.taxable}
                      onChange={(e) =>
                        updateItem(it.key, { taxable: e.target.checked })
                      }
                    />
                    Taxable
                  </label>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">Total</h2>
            </CardHeader>
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatPrice(subtotalCents)} />
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-400">
                  Tax rate
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="ml-2 w-20 border border-[#1f1f24] rounded-lg px-2 py-1 text-sm"
                  />
                  <span className="ml-1 text-zinc-500">%</span>
                </div>
                <div className="font-bold text-white tracking-tight">
                  {formatPrice(taxCents)}
                </div>
              </div>
              <div className="border-t border-[#1f1f24] pt-2">
                <Row
                  label={
                    <span className="text-base font-extrabold text-white tracking-tight">
                      Total
                    </span>
                  }
                  value={
                    <span className="text-base font-extrabold text-white tracking-tight">
                      {formatPrice(totalCents)}
                    </span>
                  }
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={async (c) => {
            setShowNewCustomer(false);
            await loadAll();
            setCustomerId(c.id);
            setCustomerQuery(c.name);
          }}
        />
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl p-5 shadow-sm">
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-zinc-400">{label}</div>
      <div className="font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={
        "w-full text-left rounded-xl border p-3 transition " +
        (checked
          ? "border-slate-900 bg-black"
          : "border-[#1f1f24] hover:border-[#2a2a32]")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 " +
            (checked ? "border-slate-900" : "border-[#2a2a32]")
          }
        >
          {checked && (
            <span className="m-auto h-2 w-2 rounded-full bg-slate-900" />
          )}
        </span>
        <div>
          <div className="text-sm font-bold text-white tracking-tight">{title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{description}</div>
        </div>
      </div>
    </button>
  );
}

function CustomerPicker({
  customers,
  selectedId,
  query,
  setQuery,
  onPick,
  onClear,
}: {
  customers: Customer[];
  selectedId: number | null;
  query: string;
  setQuery: (v: string) => void;
  onPick: (c: Customer) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, query]);

  return (
    <div ref={ref} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onClear();
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search"
        className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12] pl-9"
      />
      <span className="absolute left-3 top-2.5 text-zinc-500" aria-hidden>
        ⌕
      </span>
      {open && suggestions.length > 0 && !selectedId && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-black text-sm"
            >
              <div className="font-bold text-white tracking-tight">{c.name}</div>
              {(c.formatted_address || c.address) && (
                <div className="text-xs text-zinc-400 truncate">
                  {c.formatted_address || c.address}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Customer) => void | Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setErr("First and last name are required");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Could not create customer");
      return;
    }
    const created = (await res.json()) as Customer;
    await onCreated(created);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={save}
        className="bg-[#0f0f12] rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-extrabold text-white tracking-tight">
            New customer
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Address">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
          >
            {saving ? "Saving…" : "Save customer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
