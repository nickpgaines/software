"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = "profile" | "company" | "payments" | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "company", label: "Company" },
  { key: "payments", label: "Payments" },
  { key: "billing", label: "Billing" },
];

export default function SettingsTabs({ username }: { username: string }) {
  return (
    <Suspense fallback={null}>
      <SettingsTabsInner username={username} />
    </Suspense>
  );
}

function SettingsTabsInner({ username }: { username: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    if (TABS.some((x) => x.key === t)) return t as Tab;
    return "profile";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t) && t !== tab) {
      setTab(t as Tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function changeTab(t: Tab) {
    setTab(t);
    const url = t === "profile" ? "/settings" : `/settings?tab=${t}`;
    router.replace(url);
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
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
        {tab === "payments" && <PaymentsPanel />}
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

type StripeStatus = {
  configured: boolean;
  connected: boolean;
  account_id?: string;
  email?: string | null;
  business_name?: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due?: boolean;
  error?: string;
};

function PaymentsPanel() {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/status");
      const data = (await res.json()) as StripeStatus;
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setStatus(null);
      } else {
        setStatus(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function startConnect() {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch("/api/stripe/connect/start", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start onboarding");
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    if (
      !confirm(
        "Disconnect this Stripe account? You can reconnect any time, but you won't be able to charge cards until you do."
      )
    )
      return;
    setWorking(true);
    try {
      await fetch("/api/stripe/connect/disconnect", { method: "POST" });
      await load();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
        <p className="text-sm text-slate-500 mt-1">
          Connect a Stripe account to accept card payments. Money is paid out
          to the bank account on file with Stripe.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : !status?.configured ? (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl px-4 py-3">
          <p className="text-sm text-amber-800 font-medium">
            Stripe platform keys aren&apos;t configured.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Add <code>STRIPE_SECRET_KEY</code> and{" "}
            <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to the deployment
            environment, then redeploy.
          </p>
        </div>
      ) : !status.connected ? (
        <div className="border border-slate-200 rounded-2xl px-4 py-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              No Stripe account connected
            </p>
            <p className="text-xs text-slate-500 mt-1">
              You&apos;ll be redirected to Stripe to enter business info, ID,
              and bank account details. This usually takes a few minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={startConnect}
            disabled={working}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
          >
            {working ? "Opening Stripe…" : "Connect Stripe"}
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl px-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    "inline-block w-2 h-2 rounded-full " +
                    (status.charges_enabled
                      ? "bg-emerald-500"
                      : "bg-amber-500")
                  }
                />
                <p className="text-sm font-medium text-slate-900">
                  {status.business_name ||
                    status.email ||
                    "Connected Stripe account"}
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {status.account_id}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="text-xs text-slate-500 hover:text-slate-900"
              title="Re-check status"
            >
              Refresh
            </button>
          </div>

          <dl className="grid grid-cols-3 gap-2 pt-1">
            <Capability ok={status.charges_enabled} label="Charges" />
            <Capability ok={status.payouts_enabled} label="Payouts" />
            <Capability ok={status.details_submitted} label="Onboarding" />
          </dl>

          {(!status.charges_enabled ||
            !status.payouts_enabled ||
            status.requirements_due) && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2">
              <p className="text-xs text-amber-800">
                Stripe still needs more information before this account can
                accept payments or receive payouts.
              </p>
              <button
                type="button"
                onClick={startConnect}
                disabled={working}
                className="mt-2 text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-slate-400 text-white rounded-full px-3 py-1.5 font-medium"
              >
                {working ? "Opening Stripe…" : "Finish onboarding"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <a
              href="https://dashboard.stripe.com/"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-500"
            >
              Open Stripe dashboard ↗
            </a>
            <button
              type="button"
              onClick={disconnect}
              disabled={working}
              className="text-xs text-rose-600 hover:text-rose-500 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function Capability({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={
        "rounded-xl px-3 py-2 text-center " +
        (ok
          ? "bg-emerald-50 border border-emerald-200"
          : "bg-slate-50 border border-slate-200")
      }
    >
      <div
        className={
          "text-xs font-medium " +
          (ok ? "text-emerald-700" : "text-slate-500")
        }
      >
        {label}
      </div>
      <div
        className={
          "text-xs mt-0.5 " + (ok ? "text-emerald-600" : "text-slate-400")
        }
      >
        {ok ? "Enabled" : "Pending"}
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
