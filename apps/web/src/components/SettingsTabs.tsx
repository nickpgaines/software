"use client";

import { useEffect, useState } from "react";

type Tab = "profile" | "company" | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "company", label: "Company" },
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
                    ? "border-cyan-500 text-cyan-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900")
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
          className="text-sm bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-300 text-white rounded-full px-5 py-2 font-medium"
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
