"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AddressFields, {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/components/customers/AddressFields";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  formatted_address: string | null;
};

type LineItem = {
  key: string;
  title: string;
  description: string;
  quantity: string;
  price: string;
};

const LEAD_SOURCES = [
  "Referral",
  "Online",
  "Door-to-door",
  "Repeat customer",
  "Other",
];

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

function emptyItem(): LineItem {
  return {
    key: uid(),
    title: "",
    description: "",
    quantity: "1",
    price: "",
  };
}

function priceCents(p: string) {
  return Math.max(0, Math.round((parseFloat(p) || 0) * 100));
}

function lineTotalCents(it: LineItem) {
  const qty = parseFloat(it.quantity) || 0;
  return Math.max(0, Math.round(qty * priceCents(it.price)));
}

export default function NewEstimateForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [leadSource, setLeadSource] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    const res = await fetch("/api/customers");
    if (res.ok) setCustomers(await res.json());
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const totalCents = useMemo(
    () => items.reduce((sum, it) => sum + lineTotalCents(it), 0),
    [items]
  );

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
      notes: notes.trim() || null,
      lead_source: leadSource || null,
      items: items
        .filter((it) => it.title.trim())
        .map((it) => ({
          title: it.title.trim(),
          description: it.description.trim() || null,
          quantity: parseFloat(it.quantity) || 1,
          price_cents: priceCents(it.price),
        })),
    };
    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not create estimate");
      return;
    }
    const created = (await res.json()) as { id: number };
    router.push(`/estimates/${created.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-white">New Estimate</h1>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold shadow-sm h-auto"
        >
          <span aria-hidden>⊕</span>
          {submitting ? "Saving…" : "Create Estimate"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Customer
            </h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowNewCustomer(true)}
              className="text-xs font-bold text-zinc-500 border-line hover:bg-black rounded-full px-3 py-1.5 h-auto"
            >
              + Create New Customer
            </Button>
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
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Line Items
            </h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => addItem()}
              className="text-xs font-bold text-zinc-500 border-line hover:bg-black rounded-full px-3 py-1.5 h-auto"
            >
              + Add item
            </Button>
          </CardHeader>

          <ul className="space-y-3">
            {items.map((it, idx) => (
              <li
                key={it.key}
                className="rounded-xl border border-line p-3 space-y-2 bg-card"
              >
                <div className="flex items-start gap-2">
                  <TitleWithPresets
                    value={it.title}
                    onChange={(v) => updateItem(it.key, { title: v })}
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeItem(it.key)}
                      className="text-zinc-500 hover:text-rose-600 px-2 h-auto"
                      aria-label={`Remove item ${idx + 1}`}
                    >
                      ✕
                    </Button>
                  )}
                </div>
                <Input
                  type="text"
                  value={it.description}
                  onChange={(e) =>
                    updateItem(it.key, { description: e.target.value })
                  }
                  placeholder="Description (optional)"
                  className="w-full border-line rounded-lg px-3 py-2 text-sm h-auto"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="block text-[10px] font-bold text-zinc-500 mb-1 font-normal">
                      Qty
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(it.key, { quantity: e.target.value })
                      }
                      className="w-full border-line rounded-lg px-3 py-2 text-sm h-auto"
                    />
                  </div>
                  <div>
                    <Label className="block text-[10px] font-bold text-zinc-500 mb-1 font-normal">
                      Price (USD)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.price}
                      onChange={(e) =>
                        updateItem(it.key, { price: e.target.value })
                      }
                      className="w-full border-line rounded-lg px-3 py-2 text-sm h-auto"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line mt-4 pt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Subtotal</span>
              <span className="font-bold text-white tracking-tight">
                {formatPrice(totalCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Total</span>
              <span className="text-base font-extrabold text-white tracking-tight">
                {formatPrice(totalCents)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Lead Source
            </h2>
          </CardHeader>
          {/* Native <select> kept: empty-string sentinel value for "Select source…" */}
          <select
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            className="w-full border border-line rounded-xl px-4 py-2 text-sm bg-card"
          >
            <option value="">Select source…</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Private Notes
            </h2>
          </CardHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Write your note here…"
            className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card"
          />
        </Card>
      </div>

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={async (c) => {
            setShowNewCustomer(false);
            await loadCustomers();
            setCustomerId(c.id);
            setCustomerQuery(c.name);
          }}
        />
      )}
    </div>
  );
}

function TitleWithPresets({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
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

  const suggestions = SERVICE_PRESETS.filter(
    (p) => !value || p.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div ref={ref} className="relative flex-1">
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Item title"
        className="w-full border-line rounded-lg px-3 py-2 text-sm h-auto"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-line rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((p) => (
            <Button
              key={p}
              type="button"
              variant="ghost"
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-black text-sm h-auto block rounded-none"
            >
              {p}
            </Button>
          ))}
        </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <Label className="block text-xs font-bold text-zinc-500 mb-2">
        {label}
      </Label>
      {children}
    </div>
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
      <Input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onClear();
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search"
        className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card pl-9 h-auto"
      />
      <span className="absolute left-3 top-2.5 text-zinc-500" aria-hidden>
        ⌕
      </span>
      {open && suggestions.length > 0 && !selectedId && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-card border border-line rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="ghost"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-black text-sm h-auto block"
            >
              <div className="font-bold text-white tracking-tight">{c.name}</div>
              {(c.formatted_address || c.address) && (
                <div className="text-xs text-zinc-400 truncate">
                  {c.formatted_address || c.address}
                </div>
              )}
            </Button>
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
  const [address, setAddress] = useState<AddressValue>({ ...EMPTY_ADDRESS });
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
        address_line1: address.address_line1,
        unit: address.unit,
        city: address.city,
        state: address.state,
        zip: address.zip,
        latitude: address.latitude,
        longitude: address.longitude,
        formatted_address: address.formatted_address,
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
        className="bg-card rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-extrabold text-white tracking-tight">
            New customer
          </h3>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-300 h-auto p-0"
          >
            ✕
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border-line rounded-xl px-3 py-2 text-sm h-auto"
              autoFocus
            />
          </Field>
          <Field label="Last name">
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border-line rounded-xl px-3 py-2 text-sm h-auto"
            />
          </Field>
        </div>
        <Field label="Phone">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border-line rounded-xl px-3 py-2 text-sm h-auto"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-line rounded-xl px-3 py-2 text-sm h-auto"
          />
        </Field>
        <AddressFields
          value={address}
          onChange={setAddress}
          inputClassName="w-full border-line rounded-xl px-3 py-2 text-sm h-auto"
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="ghost"
            disabled={saving}
            className="text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold h-auto"
          >
            {saving ? "Saving…" : "Save customer"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-sm text-zinc-400 font-bold hover:text-white h-auto"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
