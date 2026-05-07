"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

type AcceptMode = "send" | "accept" | "draft";

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

export default function NewEstimateForm() {
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
  const [validUntil, setValidUntil] = useState<string>(
    addDaysInput(todayInput(), 30)
  );
  const [soldById, setSoldById] = useState<number | "">("");
  const [acceptMode, setAcceptMode] = useState<AcceptMode>("send");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");

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
    items.some((it) => it.title.trim() && lineTotalCents(it) >= 0) &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    if (
      acceptMode === "accept" &&
      (!signatureData || !signatureName.trim())
    ) {
      setError("Customer signature and printed name are required to accept");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      customer_id: customerId,
      title: title.trim() || null,
      notes: notes.trim() || null,
      tax_rate: taxRateNum,
      valid_until: validUntil || null,
      sold_by_id: soldById || null,
      action: acceptMode,
      signature_data: acceptMode === "accept" ? signatureData : undefined,
      signature_name:
        acceptMode === "accept" ? signatureName.trim() : undefined,
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
    router.push("/customers");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-white">
            New Estimate
          </h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Build a quote for a customer and send it for approval, or accept it
            on their device.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2.5 text-sm font-bold shadow-sm h-auto"
        >
          <span aria-hidden>⊕</span>
          {submitting
            ? "Saving…"
            : acceptMode === "send"
              ? "Send Estimate"
              : acceptMode === "accept"
                ? "Accept Estimate"
                : "Save Draft"}
        </Button>
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNewCustomer(true)}
                className="text-eyebrow uppercase text-zinc-500 border-line hover:bg-black rounded-full px-3 py-1.5 h-auto"
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
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Spring window cleaning estimate"
                className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card h-auto"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valid Until">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card h-auto"
                />
              </Field>
              <Field label="Sold By">
                {/* Native <select> kept: Radix Select empty-value flag */}
                <select
                  value={soldById}
                  onChange={(e) =>
                    setSoldById(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full border border-line rounded-xl px-4 py-2 text-sm bg-card"
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything the customer should know…"
                className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card"
              />
            </Field>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Send Options
              </h2>
            </CardHeader>
            <div className="space-y-3">
              <RadioOption
                checked={acceptMode === "send"}
                onChange={() => setAcceptMode("send")}
                title="Send to customer to accept"
                description="Texts the customer the estimate. They can reply to accept."
              />
              <RadioOption
                checked={acceptMode === "accept"}
                onChange={() => setAcceptMode("accept")}
                title="Accept for customer"
                description="Capture the customer's signature on this device and accept the estimate immediately."
              />
              <RadioOption
                checked={acceptMode === "draft"}
                onChange={() => setAcceptMode("draft")}
                title="Save as draft"
                description="Don't send yet — keep this estimate as a draft."
              />
              {acceptMode === "accept" && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Customer signature
                  </div>
                  <SignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                  />
                  <Input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Printed name"
                    className="w-full border-line rounded-xl px-4 py-2 text-sm bg-card h-auto"
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Line Items
              </h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => addItem()}
                className="text-eyebrow uppercase text-zinc-500 border-line hover:bg-black rounded-full px-3 py-1.5 h-auto"
              >
                + Add item
              </Button>
            </CardHeader>

            <div className="flex flex-wrap gap-2 mb-3">
              {SERVICE_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="ghost"
                  onClick={() => addItem(p)}
                  className="text-xs bg-black hover:bg-line text-zinc-300 rounded-full px-3 py-1 h-auto"
                >
                  + {p}
                </Button>
              ))}
            </div>

            <ul className="space-y-3">
              {items.map((it, idx) => (
                <li
                  key={it.key}
                  className="rounded-xl border border-line p-3 space-y-2 bg-card"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      type="text"
                      value={it.title}
                      onChange={(e) =>
                        updateItem(it.key, { title: e.target.value })
                      }
                      placeholder="Item title"
                      className="flex-1 border-line rounded-lg px-3 py-2 text-sm h-auto"
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
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 font-normal">
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
                      <Label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 font-normal">
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
                    <div>
                      <Label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 font-normal">
                        Line total
                      </Label>
                      <div className="text-sm font-bold text-white tracking-tight px-3 py-2 bg-black rounded-lg">
                        {formatPrice(lineTotalCents(it))}
                      </div>
                    </div>
                  </div>
                  <Label className="inline-flex items-center gap-2 text-xs text-zinc-300 font-normal">
                    <Checkbox
                      checked={it.taxable}
                      onCheckedChange={(c) =>
                        updateItem(it.key, { taxable: c === true })
                      }
                    />
                    Taxable
                  </Label>
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
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="ml-2 w-20 border-line rounded-lg px-2 py-1 text-sm h-auto"
                  />
                  <span className="ml-1 text-zinc-500">%</span>
                </div>
                <div className="font-bold text-white tracking-tight">
                  {formatPrice(taxCents)}
                </div>
              </div>
              <div className="border-t border-line pt-2">
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
      <Label className="block text-eyebrow uppercase text-zinc-500 mb-2">
        {label}
      </Label>
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
    <Button
      type="button"
      variant="ghost"
      onClick={onChange}
      className={
        "w-full text-left rounded-xl border p-3 h-auto block " +
        (checked
          ? "border-slate-900 bg-black"
          : "border-line hover:border-line-strong")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 " +
            (checked ? "border-fg" : "border-line-strong")
          }
        >
          {checked && (
            <span className="m-auto h-2 w-2 rounded-full bg-fg" />
          )}
        </span>
        <div>
          <div className="text-sm font-bold text-white tracking-tight">{title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{description}</div>
        </div>
      </div>
    </Button>
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
        <Field label="Address">
          <Input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border-line rounded-xl px-3 py-2 text-sm h-auto"
          />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="ghost"
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold h-auto"
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
    ctx.strokeStyle = "#0f172a";
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
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={clear}
          className="text-xs text-zinc-400 hover:text-white h-auto"
        >
          Clear
        </Button>
        {value && (
          <span className="text-xs text-emerald-600">Signature captured</span>
        )}
      </div>
    </div>
  );
}
