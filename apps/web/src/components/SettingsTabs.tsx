"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "profile" | "company" | "subscriptions" | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "company", label: "Company" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "billing", label: "Billing" },
];

export default function SettingsTabs({ username }: { username: string }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  "whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition " +
                  (active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        {tab === "profile" && <ProfilePanel username={username} />}
        {tab === "company" && <CompanyPanel />}
        {tab === "subscriptions" && <SubscriptionsPanel />}
        {tab === "billing" && <BillingPanel />}
      </div>
    </div>
  );
}

function ProfilePanel({ username }: { username: string }) {
  const display = username || "—";
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your account information.
        </p>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReadOnlyField label="Name" value={display} />
        <ReadOnlyField label="Email" value="—" />
        <ReadOnlyField label="Role" value="Admin" />
      </dl>
      <p className="text-xs text-slate-400">
        Profile editing is coming soon.
      </p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-full px-4 py-2">
        {value}
      </dd>
    </div>
  );
}

type Company = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
};

function CompanyPanel() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Company | null) => {
        if (c) {
          setName(c.name ?? "");
          setAddress(c.address ?? "");
          setPhone(c.phone ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, phone }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save");
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Company</h2>
        <p className="text-sm text-slate-500 mt-1">
          Information that appears on invoices and customer-facing materials.
        </p>
      </div>
      <Field label="Company name">
        <input
          type="text"
          value={name}
          disabled={loading}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="Acme Window Cleaning"
        />
      </Field>
      <Field label="Address">
        <input
          type="text"
          value={address}
          disabled={loading}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="123 Main St, Springfield, IL"
        />
      </Field>
      <Field label="Phone">
        <input
          type="tel"
          value={phone}
          disabled={loading}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="(555) 555-5555"
        />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || loading}
          className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  );
}

type SubscriptionInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

type SubscriptionTemplate = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  interval: SubscriptionInterval;
  active: number;
  created_at: string;
  updated_at: string;
};

type CustomerSubscription = {
  id: number;
  customer_id: number;
  template_id: number | null;
  name: string;
  description: string | null;
  price_cents: number;
  interval: SubscriptionInterval;
  status: "pending" | "active" | "declined" | "canceled";
  sent_at: string | null;
  accepted_at: string | null;
  canceled_at: string | null;
  created_at: string;
};

type CustomerLite = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
};

const INTERVAL_LABELS: Record<SubscriptionInterval, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function emptyForm(): {
  name: string;
  description: string;
  price: string;
  interval: SubscriptionInterval;
  active: boolean;
} {
  return {
    name: "",
    description: "",
    price: "",
    interval: "monthly",
    active: true,
  };
}

function SubscriptionsPanel() {
  const [templates, setTemplates] = useState<SubscriptionTemplate[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [actionTpl, setActionTpl] = useState<SubscriptionTemplate | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [tplRes, subRes, custRes] = await Promise.all([
        fetch("/api/settings/subscriptions"),
        fetch("/api/customer-subscriptions"),
        fetch("/api/customers"),
      ]);
      if (tplRes.ok) setTemplates(await tplRes.json());
      if (subRes.ok) setSubscriptions(await subRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch {
      setError("Could not load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function startNew() {
    setForm(emptyForm());
    setEditingId("new");
  }

  function startEdit(t: SubscriptionTemplate) {
    setForm({
      name: t.name,
      description: t.description || "",
      price: (t.price_cents / 100).toFixed(2),
      interval: t.interval,
      active: t.active === 1,
    });
    setEditingId(t.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const priceCents = Math.max(
      0,
      Math.round((parseFloat(form.price) || 0) * 100)
    );
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: priceCents,
      interval: form.interval,
      active: form.active,
    };
    const url =
      editingId === "new"
        ? "/api/settings/subscriptions"
        : `/api/settings/subscriptions/${editingId}`;
    const method = editingId === "new" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save template");
      return;
    }
    cancelEdit();
    await reload();
  }

  async function deleteTemplate(id: number) {
    if (!confirm("Delete this subscription template?")) return;
    const res = await fetch(`/api/settings/subscriptions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Could not delete template");
      return;
    }
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Subscriptions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Create subscription templates to send to customers or accept on a
            customer&apos;s device.
          </p>
        </div>
        {editingId === null && (
          <button
            onClick={startNew}
            className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-2 font-medium"
          >
            New template
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {editingId !== null && (
        <form
          onSubmit={saveTemplate}
          className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId === "new" ? "New template" : "Edit template"}
          </h3>
          <Field label="Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
              placeholder="Monthly Window Cleaning"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full border border-slate-200 rounded-2xl px-4 py-2 text-sm bg-white"
              placeholder="Includes interior + exterior windows…"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Price (USD)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
                placeholder="49.00"
              />
            </Field>
            <Field label="Billing interval">
              <select
                value={form.interval}
                onChange={(e) =>
                  setForm({
                    ...form,
                    interval: e.target.value as SubscriptionInterval,
                  })
                }
                className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
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
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Templates
        </h3>
        {loading && templates.length === 0 ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-slate-500">
            No templates yet. Create one to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {t.name}
                    </span>
                    {t.active === 0 && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formatPrice(t.price_cents)} ·{" "}
                    {INTERVAL_LABELS[t.interval]}
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {t.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActionTpl(t)}
                    disabled={t.active === 0}
                    className="text-xs bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-full px-3 py-1.5 font-medium"
                  >
                    Send / Accept
                  </button>
                  <button
                    onClick={() => startEdit(t)}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="text-xs text-rose-600 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecentSubscriptions
        subscriptions={subscriptions}
        customers={customers}
        onChange={reload}
      />

      {actionTpl && (
        <SendOrAcceptModal
          template={actionTpl}
          customers={customers}
          onClose={() => setActionTpl(null)}
          onDone={async () => {
            setActionTpl(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function RecentSubscriptions({
  subscriptions,
  customers,
  onChange,
}: {
  subscriptions: CustomerSubscription[];
  customers: CustomerLite[];
  onChange: () => void | Promise<void>;
}) {
  const customerMap = useMemo(() => {
    const m = new Map<number, CustomerLite>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  if (subscriptions.length === 0) return null;

  async function updateStatus(
    id: number,
    status: CustomerSubscription["status"]
  ) {
    const res = await fetch(`/api/customer-subscriptions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await onChange();
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        Recent subscriptions
      </h3>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
        {subscriptions.slice(0, 10).map((s) => {
          const cust = customerMap.get(s.customer_id);
          return (
            <li
              key={s.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {cust?.name || `Customer #${s.customer_id}`}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.name} · {formatPrice(s.price_cents)} /{" "}
                  {INTERVAL_LABELS[s.interval].toLowerCase()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={s.status} />
                {s.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(s.id, "active")}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-3 py-1.5 font-medium"
                    >
                      Mark accepted
                    </button>
                    <button
                      onClick={() => updateStatus(s.id, "declined")}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Decline
                    </button>
                  </>
                )}
                {s.status === "active" && (
                  <button
                    onClick={() => updateStatus(s.id, "canceled")}
                    className="text-xs text-rose-600 hover:text-rose-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: CustomerSubscription["status"] }) {
  const styles: Record<CustomerSubscription["status"], string> = {
    pending: "bg-amber-100 text-amber-800",
    active: "bg-emerald-100 text-emerald-800",
    declined: "bg-slate-100 text-slate-600",
    canceled: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={
        "text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 " +
        styles[status]
      }
    >
      {status}
    </span>
  );
}

function SendOrAcceptModal({
  template,
  customers,
  onClose,
  onDone,
}: {
  template: SubscriptionTemplate;
  customers: CustomerLite[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [customerId, setCustomerId] = useState<number | "">(
    customers[0]?.id ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(action: "send" | "accept") {
    if (!customerId) {
      setErr("Pick a customer");
      return;
    }
    setSubmitting(true);
    setErr(null);
    const res = await fetch("/api/customer-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        template_id: template.id,
        action,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setErr(action === "send" ? "Could not send" : "Could not accept");
      return;
    }
    await onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {template.name}
            </h3>
            <p className="text-xs text-slate-500">
              {formatPrice(template.price_cents)} ·{" "}
              {INTERVAL_LABELS[template.interval]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {template.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {template.description}
          </p>
        )}

        <Field label="Customer">
          <select
            value={customerId}
            onChange={(e) =>
              setCustomerId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={() => submit("send")}
            disabled={submitting}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-4 py-2 font-medium flex-1"
          >
            Send to customer
          </button>
          <button
            onClick={() => submit("accept")}
            disabled={submitting}
            className="text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-full px-4 py-2 font-medium flex-1"
          >
            Accept on device
          </button>
        </div>
        <p className="text-xs text-slate-400">
          &quot;Send&quot; messages the customer with the offer.
          &quot;Accept on device&quot; activates it immediately for in-person
          sign-ups.
        </p>
      </div>
    </div>
  );
}

function BillingPanel() {
  return (
    <div className="space-y-2 py-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
      <p className="text-sm text-slate-500">Coming soon.</p>
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
    <div>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
