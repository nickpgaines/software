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

type Staff = {
  id: number;
  name: string;
  role: string | null;
};

type SubscriptionInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "triannually"
  | "semiannually"
  | "yearly";

type SubscriptionTerms = {
  id: number;
  name: string;
  body: string;
};

type SubscriptionTemplate = {
  id: number;
  name: string;
  description: string | null;
  active: number;
  terms_id: number | null;
  require_signature: number;
};

const INTERVAL_LABELS: Record<SubscriptionInterval, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly (every 3 months)",
  triannually: "Tri-annually (every 4 months)",
  semiannually: "Bi-annually (every 6 months)",
  yearly: "Yearly",
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateLabel(dateInput: string) {
  if (!dateInput) return "Pick a date";
  const [y, m, d] = dateInput.split("-").map(Number);
  if (!y || !m || !d) return dateInput;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function intervalDays(i: SubscriptionInterval): number {
  switch (i) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "triannually":
      return 122;
    case "semiannually":
      return 182;
    case "monthly":
      return 30;
    case "quarterly":
      return 91;
    case "yearly":
      return 365;
  }
}

function addDays(dateInput: string, days: number): string {
  const [y, m, d] = dateInput.split("-").map(Number);
  if (!y || !m || !d) return dateInput;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

type AcceptMode = "send" | "accept";

export default function NewSubscriptionForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [templates, setTemplates] = useState<SubscriptionTemplate[]>([]);
  const [terms, setTerms] = useState<SubscriptionTerms[]>([]);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [startDate, setStartDate] = useState<string>(todayDateInput());
  const [soldById, setSoldById] = useState<number | "">("");

  const [templateId, setTemplateId] = useState<number | "">("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState<SubscriptionInterval>("monthly");

  const [acceptMode, setAcceptMode] = useState<AcceptMode>("send");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    const [custRes, staffRes, tplRes, termsRes] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/staff"),
      fetch("/api/settings/subscriptions"),
      fetch("/api/settings/subscription-terms"),
    ]);
    if (custRes.ok) setCustomers(await custRes.json());
    if (staffRes.ok) setStaff(await staffRes.json());
    if (tplRes.ok) setTemplates(await tplRes.json());
    if (termsRes.ok) setTerms(await termsRes.json());
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  );

  const linkedTerms = useMemo(
    () =>
      selectedTemplate?.terms_id
        ? terms.find((t) => t.id === selectedTemplate.terms_id) || null
        : null,
    [selectedTemplate, terms]
  );

  const requireSignature = selectedTemplate?.require_signature === 1;

  const includedVisits = useMemo(() => {
    if (!selectedTemplate || !startDate) return [] as { date: string }[];
    const days = intervalDays(interval);
    const out: { date: string }[] = [];
    for (let i = 0; i < 4; i++) {
      out.push({ date: addDays(startDate, days * i) });
    }
    return out;
  }, [selectedTemplate, startDate, interval]);

  const priceCents = Math.max(0, Math.round((parseFloat(price) || 0) * 100));
  const canSubmit =
    !!customerId &&
    !!templateId &&
    !!startDate &&
    priceCents > 0 &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/customer-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        template_id: templateId,
        price_cents: priceCents,
        interval,
        action: acceptMode,
        start_date: startDate,
        sold_by_id: soldById || null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not create subscription");
      return;
    }
    router.push("/settings?tab=subscriptions");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            New Subscription
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sell or set up a recurring subscription for a customer.
          </p>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2.5 text-sm font-medium shadow-sm"
        >
          <span aria-hidden>⊕</span>
          {submitting ? "Creating…" : "Create Subscription"}
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
              <h2 className="text-base font-semibold text-slate-900">
                Customer
              </h2>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5"
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
              <div className="text-xs text-slate-500 mt-2">
                {selectedCustomer.formatted_address ||
                  selectedCustomer.address ||
                  "—"}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-900">
                Schedule
              </h2>
            </CardHeader>
            <Field label="Start Date">
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {formatDateLabel(startDate)}
                </div>
              </div>
            </Field>
            <Field label="Sold By">
              <select
                value={soldById}
                onChange={(e) =>
                  setSoldById(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white"
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
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-900">
                Accept Plan
              </h2>
            </CardHeader>
            <div className="space-y-3">
              <RadioOption
                checked={acceptMode === "send"}
                onChange={() => setAcceptMode("send")}
                title="Send to customer to accept"
                description="Once you send this plan, your customer will be able to accept it and enter their payment information to start."
              />
              <RadioOption
                checked={acceptMode === "accept"}
                onChange={() => setAcceptMode("accept")}
                title="Accept for customer"
                description="Enter payment information and accept this plan on behalf of your customer."
              />
              {acceptMode === "accept" && requireSignature && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This template requires a signature. After creating the
                  subscription, capture the signature on the subscription
                  detail page.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-900">Plan</h2>
            </CardHeader>
            <Field label="Plan Template">
              <select
                value={templateId}
                onChange={(e) =>
                  setTemplateId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white"
              >
                <option value="">Select plan template…</option>
                {templates
                  .filter((t) => t.active === 1)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => setShowNewTemplate(true)}
              className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              + Create new template
            </button>
            {selectedTemplate && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <div className="font-medium text-slate-900">
                  {selectedTemplate.name}
                </div>
                {selectedTemplate.description && (
                  <div className="whitespace-pre-wrap">
                    {selectedTemplate.description}
                  </div>
                )}
                {linkedTerms && (
                  <div className="text-slate-500">
                    Terms: <span className="font-medium">{linkedTerms.name}</span>
                  </div>
                )}
                {selectedTemplate.require_signature === 1 && (
                  <div className="text-slate-500">Signature required</div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Field label="Price (USD)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="49.00"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white"
                />
              </Field>
              <Field label="Billing & service frequency">
                <select
                  value={interval}
                  onChange={(e) =>
                    setInterval(e.target.value as SubscriptionInterval)
                  }
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white"
                >
                  {(
                    Object.entries(INTERVAL_LABELS) as [
                      SubscriptionInterval,
                      string,
                    ][]
                  ).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-900">
                Included Visits
              </h2>
            </CardHeader>
            {!selectedTemplate ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Select a plan template to see included visits.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {includedVisits.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="text-sm text-slate-900">
                      Visit {i + 1}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateLabel(v.date)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {selectedTemplate && (
              <p className="text-[11px] text-slate-400 mt-2">
                Projected based on {INTERVAL_LABELS[interval].toLowerCase()}{" "}
                cadence from the start date.
              </p>
            )}
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

      {showNewTemplate && (
        <NewTemplateModal
          terms={terms}
          onClose={() => setShowNewTemplate(false)}
          onCreated={async (t) => {
            setShowNewTemplate(false);
            await loadAll();
            setTemplateId(t.id);
          }}
        />
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
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
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}
      </label>
      {children}
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
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 hover:border-slate-300")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 " +
            (checked
              ? "border-slate-900"
              : "border-slate-300")
          }
        >
          {checked && (
            <span className="m-auto h-2 w-2 rounded-full bg-slate-900" />
          )}
        </span>
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <div className="text-xs text-slate-500 mt-0.5">{description}</div>
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
        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white pl-9"
      />
      <span className="absolute left-3 top-2.5 text-slate-400" aria-hidden>
        ⌕
      </span>
      {open && suggestions.length > 0 && !selectedId && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
            >
              <div className="font-medium text-slate-900">{c.name}</div>
              {(c.formatted_address || c.address) && (
                <div className="text-xs text-slate-500 truncate">
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            New customer
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-700"
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
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Address">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
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
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function NewTemplateModal({
  terms,
  onClose,
  onCreated,
}: {
  terms: SubscriptionTerms[];
  onClose: () => void;
  onCreated: (t: SubscriptionTemplate) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [termsId, setTermsId] = useState<number | "">("");
  const [requireSignature, setRequireSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/settings/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        active: true,
        terms_id: termsId || null,
        require_signature: requireSignature,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setErr("Could not save template");
      return;
    }
    const created = (await res.json()) as SubscriptionTemplate;
    await onCreated(created);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={save}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            New plan template
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Monthly Window Cleaning"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <p className="text-xs text-slate-500 -mt-1">
          Price and billing interval are set per customer when you create a
          subscription from this template.
        </p>
        <Field label="Terms (optional)">
          <select
            value={termsId}
            onChange={(e) =>
              setTermsId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requireSignature}
            onChange={(e) => setRequireSignature(e.target.checked)}
          />
          Require signature
        </label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
