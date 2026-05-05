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
          <h1 className="text-page-title text-white">
            New Subscription
          </h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Sell or set up a recurring subscription for a customer.
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
          {submitting ? "Creating…" : "Create Subscription"}
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
                className="text-eyebrow uppercase text-zinc-500 border-[#1f1f24] hover:bg-black rounded-full px-3 py-1.5 h-auto"
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
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Schedule
              </h2>
            </CardHeader>
            <Field label="Start Date">
              <div className="relative">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12] h-auto"
                />
                <div className="text-xs text-zinc-400 mt-1">
                  {formatDateLabel(startDate)}
                </div>
              </div>
            </Field>
            <Field label="Sold By">
              {/* Native <select> kept: salesperson picker */}
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
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-extrabold text-white tracking-tight">
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
              <h2 className="text-base font-extrabold text-white tracking-tight">Plan</h2>
            </CardHeader>
            <Field label="Plan Template">
              {/* Native <select> kept: plan template picker */}
              <select
                value={templateId}
                onChange={(e) =>
                  setTemplateId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12]"
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowNewTemplate(true)}
              className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700 h-auto p-0"
            >
              + Create new template
            </Button>
            {selectedTemplate && (
              <div className="mt-3 rounded-xl border border-[#1f1f24] bg-black p-3 text-xs text-zinc-400 space-y-1">
                <div className="font-bold text-white tracking-tight">
                  {selectedTemplate.name}
                </div>
                {selectedTemplate.description && (
                  <div className="whitespace-pre-wrap">
                    {selectedTemplate.description}
                  </div>
                )}
                {linkedTerms && (
                  <div className="text-zinc-400">
                    Terms: <span className="font-bold">{linkedTerms.name}</span>
                  </div>
                )}
                {selectedTemplate.require_signature === 1 && (
                  <div className="text-zinc-400">Signature required</div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Field label="Price (USD)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="49.00"
                  className="w-full border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12] h-auto"
                />
              </Field>
              <Field label="Billing & service frequency">
                {/* Native <select> kept: billing interval picker */}
                <select
                  value={interval}
                  onChange={(e) =>
                    setInterval(e.target.value as SubscriptionInterval)
                  }
                  className="w-full border border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12]"
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
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Included Visits
              </h2>
            </CardHeader>
            {!selectedTemplate ? (
              <p className="text-sm text-zinc-400 font-bold py-6 text-center">
                Select a plan template to see included visits.
              </p>
            ) : (
              <ul className="divide-y divide-[#1f1f24] rounded-xl border border-[#1f1f24] bg-[#0f0f12]">
                {includedVisits.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="text-sm text-white">
                      Visit {i + 1}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {formatDateLabel(v.date)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {selectedTemplate && (
              <p className="text-[11px] text-zinc-500 mt-2">
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
      <Label className="block text-eyebrow uppercase text-zinc-500 mb-2">
        {label}
      </Label>
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
    <Button
      type="button"
      variant="ghost"
      onClick={onChange}
      className={
        "w-full text-left rounded-xl border p-3 h-auto block " +
        (checked
          ? "border-slate-900 bg-black"
          : "border-[#1f1f24] hover:border-[#2a2a32]")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 " +
            (checked
              ? "border-slate-900"
              : "border-[#2a2a32]")
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
        className="w-full border-[#1f1f24] rounded-xl px-4 py-2 text-sm bg-[#0f0f12] pl-9 h-auto"
      />
      <span className="absolute left-3 top-2.5 text-zinc-500" aria-hidden>
        ⌕
      </span>
      {open && suggestions.length > 0 && !selectedId && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="ghost"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-black text-sm h-auto block rounded-none"
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
        className="bg-[#0f0f12] rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
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
              className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm h-auto"
              autoFocus
            />
          </Field>
          <Field label="Last name">
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm h-auto"
            />
          </Field>
        </div>
        <Field label="Phone">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm h-auto"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm h-auto"
          />
        </Field>
        <Field label="Address">
          <Input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm h-auto"
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
            className="text-sm text-zinc-400 font-bold hover:text-white h-auto p-0"
          >
            Cancel
          </Button>
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
        className="bg-[#0f0f12] rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-extrabold text-white tracking-tight">
            New plan template
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
        <Field label="Name">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Monthly Window Cleaning"
            className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm h-auto"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <p className="text-xs text-zinc-400 -mt-1">
          Price and billing interval are set per customer when you create a
          subscription from this template.
        </p>
        <Field label="Terms (optional)">
          {/* Native <select> kept: terms picker */}
          <select
            value={termsId}
            onChange={(e) =>
              setTermsId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full border border-[#1f1f24] rounded-xl px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Label className="inline-flex items-center gap-2 text-sm text-zinc-300 font-bold">
          <Checkbox
            checked={requireSignature}
            onCheckedChange={(v) => setRequireSignature(v === true)}
          />
          Require signature
        </Label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="ghost"
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold h-auto"
          >
            {saving ? "Saving…" : "Save template"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-sm text-zinc-400 font-bold hover:text-white h-auto p-0"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
