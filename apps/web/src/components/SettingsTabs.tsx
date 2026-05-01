"use client";

import { useEffect, useState } from "react";

type Tab = "profile" | "company" | "messaging" | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "company", label: "Company" },
  { key: "messaging", label: "Messaging" },
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
        {tab === "messaging" && <MessagingPanel />}
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

type MessagingStatus = {
  provider: string;
  account_sid_masked: string | null;
  auth_token_set: boolean;
  from_number: string | null;
  configured: boolean;
  updated_at: string;
};

function MessagingPanel() {
  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/messaging");
    if (res.ok) {
      const s = (await res.json()) as MessagingStatus;
      setStatus(s);
      setFromNumber(s.from_number ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/messages/webhook`);
    }
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/messaging", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_sid: accountSid || undefined,
        auth_token: authToken || undefined,
        from_number: fromNumber || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not save");
      return;
    }
    const s = (await res.json()) as MessagingStatus;
    setStatus(s);
    setAccountSid("");
    setAuthToken("");
    setFromNumber(s.from_number ?? "");
    setSavedAt(Date.now());
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Messaging</h2>
        <p className="text-sm text-slate-500 mt-1">
          Connect your Twilio account to send and receive SMS from the Messages
          tab. Each business uses its own Twilio number.
        </p>
      </div>

      <div
        className={
          "flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1 w-fit " +
          (status?.configured
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-slate-100 text-slate-600 border border-slate-200")
        }
      >
        <span
          className={
            "w-1.5 h-1.5 rounded-full " +
            (status?.configured ? "bg-emerald-500" : "bg-slate-400")
          }
        />
        {status?.configured ? "Connected" : "Not connected"}
        {status?.from_number && (
          <span className="text-slate-500 font-normal">
            · {status.from_number}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
        <div className="font-medium text-slate-900">Setup steps</div>
        <ol className="list-decimal list-inside space-y-1 text-slate-600">
          <li>
            Sign up at{" "}
            <a
              href="https://www.twilio.com/try-twilio"
              target="_blank"
              rel="noreferrer"
              className="text-slate-900 underline"
            >
              twilio.com
            </a>{" "}
            and buy a local number with SMS enabled.
          </li>
          <li>
            Copy your <span className="font-mono">Account SID</span> and{" "}
            <span className="font-mono">Auth Token</span> from the Twilio
            Console dashboard.
          </li>
          <li>Paste them below along with the number you bought.</li>
          <li>
            In Twilio, open your number&apos;s settings and set{" "}
            <span className="font-medium">A message comes in</span> to the
            webhook URL below (HTTP POST).
          </li>
        </ol>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">
            Inbound webhook URL
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono text-xs"
            />
            <button
              type="button"
              onClick={copyWebhook}
              className="text-sm bg-white border border-slate-200 hover:bg-slate-100 rounded-full px-4 py-2 font-medium"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <Field label="Account SID">
        <input
          type="text"
          value={accountSid}
          disabled={loading}
          onChange={(e) => setAccountSid(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono"
          placeholder={
            status?.account_sid_masked || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          }
        />
      </Field>
      <Field label="Auth Token">
        <input
          type="password"
          value={authToken}
          disabled={loading}
          onChange={(e) => setAuthToken(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono"
          placeholder={
            status?.auth_token_set ? "•••••••••••••••• (saved)" : "Auth Token"
          }
        />
      </Field>
      <Field label="From number">
        <input
          type="tel"
          value={fromNumber}
          disabled={loading}
          onChange={(e) => setFromNumber(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="+18435551234"
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
