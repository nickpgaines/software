"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab =
  | "profile"
  | "company"
  | "payments"
  | "subscriptions"
  | "messaging"
  | "calling"
  | "email"
  | "ai"
  | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "company", label: "Company" },
  { key: "payments", label: "Payments" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "messaging", label: "Messaging" },
  { key: "calling", label: "Calling" },
  { key: "email", label: "Email" },
  { key: "ai", label: "AI" },
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
        {tab === "subscriptions" && <SubscriptionsPanel />}
        {tab === "messaging" && <MessagingPanel />}
        {tab === "calling" && <CallingPanel />}
        {tab === "email" && <EmailPanel />}
        {tab === "ai" && <AiPanel />}
        {tab === "billing" && <BillingPanel />}
      </div>
    </div>
  );
}

type Me = {
  identity: string;
  is_admin_account: boolean;
  staff: {
    id: number;
    name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    color: string;
    permission_level: string;
    photo_url: string | null;
  } | null;
};

const PERMISSION_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  team_lead: "Team Lead",
  salesperson_all: "Salesperson (All Jobs)",
  salesperson_own: "Salesperson (Own Jobs Only)",
  field_tech: "Field Tech",
  custom: "Custom",
};

async function processProfileImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = objectUrl;
    });
    const MAX = 320;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function ProfilePanel({ username }: { username: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Me | null) => {
        setMe(m);
        setPhotoUrl(m?.staff?.photo_url ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("Image is too large (max 8 MB)");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await processProfileImage(file);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not load image");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setSavedAt(null);
    setPhotoError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: photoUrl }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setPhotoError(data.error || `Could not save (HTTP ${res.status})`);
        return;
      }
      const updated = (await res.json()) as Me;
      setMe(updated);
      setPhotoUrl(updated.staff?.photo_url ?? null);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const staff = me?.staff;
  const displayName =
    staff?.name?.trim() ||
    (me?.is_admin_account ? "Admin" : me?.identity || username || "—");
  const email = staff?.email || (me?.is_admin_account ? "—" : "—");
  const role = staff
    ? PERMISSION_LABELS[staff.permission_level] || "Staff"
    : me?.is_admin_account
    ? "Admin"
    : "—";
  const isAdminEnv = me?.is_admin_account === true;
  const dirty = (staff?.photo_url ?? null) !== photoUrl;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your account information.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="flex items-start gap-5">
            <div className="w-[120px] h-[120px] rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl text-slate-400">
                  {(displayName[0] || "?").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoBusy || isAdminEnv}
                  className="text-sm border border-slate-300 hover:border-slate-400 rounded-full px-4 py-2 text-slate-700 disabled:opacity-50"
                >
                  {photoBusy
                    ? "Loading…"
                    : photoUrl
                    ? "Change photo"
                    : "Add photo"}
                </button>
                {photoUrl && !isAdminEnv && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="text-sm text-slate-500 hover:text-slate-900"
                  >
                    Remove
                  </button>
                )}
              </div>
              {isAdminEnv && (
                <p className="text-xs text-slate-400">
                  This is the built-in admin account. Create an employee record to
                  manage your own profile.
                </p>
              )}
              {photoError && (
                <p className="text-xs text-rose-600">{photoError}</p>
              )}
              {dirty && !isAdminEnv && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-4 py-2 font-medium"
                >
                  {saving ? "Saving…" : "Save photo"}
                </button>
              )}
              {savedAt && !saving && !dirty && (
                <p className="text-xs text-emerald-600">Saved</p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadOnlyField label="Name" value={displayName} />
            <ReadOnlyField label="Email" value={email} />
            <ReadOnlyField label="Role" value={role} />
          </dl>

          {!isAdminEnv && (
            <p className="text-xs text-slate-400">
              To change your name, email, or password, edit your record from
              the <span className="font-medium">Employees</span> page.
            </p>
          )}
        </>
      )}
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
  oauth_configured?: boolean;
  connected: boolean;
  account_id?: string;
  account_type?: "express" | "standard";
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
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const oauthError = searchParams.get("connect_error");
    if (oauthError) {
      setError(oauthError);
      const next = new URLSearchParams(searchParams);
      next.delete("connect_error");
      const qs = next.toString();
      router.replace(`/settings${qs ? `?${qs}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  async function go(endpoint: string, busyLabel: string) {
    setError(null);
    setWorking(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : busyLabel);
    } finally {
      setWorking(false);
    }
  }

  const startConnect = () => go("/api/stripe/connect/start", "Failed to start onboarding");
  const startOAuth = () => go("/api/stripe/connect/oauth-start", "Failed to start sign-in");

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
        <div className="border border-slate-200 rounded-2xl px-4 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-900">
              No Stripe account connected
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Already use Stripe? Sign in to connect your existing account.
              Otherwise, create a new one — we&apos;ll guide you through bank
              and ID verification in a few minutes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={startConnect}
              disabled={working}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
            >
              {working ? "Opening Stripe…" : "Create new Stripe account"}
            </button>
            <button
              type="button"
              onClick={startOAuth}
              disabled={working || !status.oauth_configured}
              title={
                status.oauth_configured
                  ? undefined
                  : "Set STRIPE_CONNECT_CLIENT_ID to enable sign-in"
              }
              className="text-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 rounded-full px-5 py-2 font-medium"
            >
              Sign in to existing Stripe
            </button>
          </div>
          {!status.oauth_configured && (
            <p className="text-xs text-slate-400">
              The &ldquo;Sign in&rdquo; option is unavailable until{" "}
              <code>STRIPE_CONNECT_CLIENT_ID</code> is set in the deployment
              environment.
            </p>
          )}
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
                {status.account_type && (
                  <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wide font-sans not-italic">
                    {status.account_type === "standard"
                      ? "Existing account"
                      : "New account"}
                  </span>
                )}
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
type SubscriptionInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "triannually"
  | "semiannually"
  | "yearly";

type SubscriptionTemplate = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  interval: SubscriptionInterval;
  active: number;
  terms_id: number | null;
  require_signature: number;
  created_at: string;
  updated_at: string;
};

type SubscriptionTerms = {
  id: number;
  name: string;
  body: string;
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
  quarterly: "Quarterly (every 3 months)",
  triannually: "Tri-annually (every 4 months)",
  semiannually: "Bi-annually (every 6 months)",
  yearly: "Yearly",
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type TemplateForm = {
  name: string;
  description: string;
  active: boolean;
  terms_id: number | null;
  require_signature: boolean;
};

function emptyForm(): TemplateForm {
  return {
    name: "",
    description: "",
    active: true,
    terms_id: null,
    require_signature: false,
  };
}

function SubscriptionsPanel() {
  const [templates, setTemplates] = useState<SubscriptionTemplate[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [terms, setTerms] = useState<SubscriptionTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [actionTpl, setActionTpl] = useState<SubscriptionTemplate | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [tplRes, subRes, custRes, termsRes] = await Promise.all([
        fetch("/api/settings/subscriptions"),
        fetch("/api/customer-subscriptions"),
        fetch("/api/customers"),
        fetch("/api/settings/subscription-terms"),
      ]);
      if (tplRes.ok) setTemplates(await tplRes.json());
      if (subRes.ok) setSubscriptions(await subRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (termsRes.ok) setTerms(await termsRes.json());
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
      active: t.active === 1,
      terms_id: t.terms_id,
      require_signature: t.require_signature === 1,
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
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      terms_id: form.terms_id,
      require_signature: form.require_signature,
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
          <p className="text-xs text-slate-500 -mt-1">
            Price and billing interval are set per customer when you create a
            subscription from this template — no need to make a separate
            template per price point.
          </p>
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Terms
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Optional terms shown to the customer when this subscription
                is sent or accepted.
              </p>
              <select
                value={form.terms_id ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    terms_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
              >
                <option value="">Select terms (optional)</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Create new terms +
              </button>
            </div>
            <label className="inline-flex items-center gap-3 text-sm text-slate-700">
              <span>Require signature</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.require_signature}
                onClick={() =>
                  setForm({
                    ...form,
                    require_signature: !form.require_signature,
                  })
                }
                className={
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " +
                  (form.require_signature ? "bg-indigo-600" : "bg-slate-300")
                }
              >
                <span
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-white transition " +
                    (form.require_signature ? "translate-x-4" : "translate-x-0.5")
                  }
                />
              </button>
            </label>
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
                    Price &amp; cadence set per customer
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
          terms={terms}
          onClose={() => setActionTpl(null)}
          onDone={async () => {
            setActionTpl(null);
            await reload();
          }}
        />
      )}

      {showTermsModal && (
        <CreateTermsModal
          onClose={() => setShowTermsModal(false)}
          onCreated={async (created) => {
            setShowTermsModal(false);
            await reload();
            setForm((f) => ({ ...f, terms_id: created.id }));
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
  terms,
  onClose,
  onDone,
}: {
  template: SubscriptionTemplate;
  customers: CustomerLite[];
  terms: SubscriptionTerms[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [customerId, setCustomerId] = useState<number | "">(
    customers[0]?.id ?? ""
  );
  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState<SubscriptionInterval>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");

  const linkedTerms = useMemo(
    () => terms.find((t) => t.id === template.terms_id) || null,
    [terms, template.terms_id]
  );
  const requireSignature = template.require_signature === 1;

  async function submit(action: "send" | "accept") {
    if (!customerId) {
      setErr("Pick a customer");
      return;
    }
    const priceCents = Math.round((parseFloat(price) || 0) * 100);
    if (priceCents <= 0) {
      setErr("Enter a price");
      return;
    }
    if (action === "accept" && requireSignature && !signatureData) {
      setErr("Customer signature is required");
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
        price_cents: priceCents,
        interval,
        action,
        signature_data: action === "accept" ? signatureData : undefined,
        signature_name:
          action === "accept" ? signatureName.trim() || undefined : undefined,
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {template.name}
            </h3>
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (USD)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="49.00"
              className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
            />
          </Field>
          <Field label="Billing interval">
            <select
              value={interval}
              onChange={(e) =>
                setInterval(e.target.value as SubscriptionInterval)
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

        {linkedTerms && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">
              Terms — {linkedTerms.name}
            </div>
            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {linkedTerms.body}
            </div>
          </div>
        )}

        {requireSignature && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Customer signature
            </div>
            <SignaturePad value={signatureData} onChange={setSignatureData} />
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Printed name"
              className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
            />
            <p className="text-[11px] text-slate-400">
              Required for &quot;Accept on device&quot;. Not needed for
              &quot;Send to customer&quot; — the customer will sign on their end.
            </p>
          </div>
        )}

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

function CreateTermsModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (terms: SubscriptionTerms) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      setErr("Name and body are required");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/settings/subscription-terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), body: body.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setErr("Could not save terms");
      return;
    }
    const created = (await res.json()) as SubscriptionTerms;
    await onCreated(created);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={save}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">New terms</h3>
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
            placeholder="Standard subscription terms"
            className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
            autoFocus
          />
        </Field>
        <Field label="Body">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Enter the full terms the customer will see and sign…"
            className="w-full border border-slate-200 rounded-2xl px-4 py-2 text-sm bg-white font-mono"
          />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
          >
            {saving ? "Saving…" : "Save terms"}
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
      <div className="border border-slate-300 rounded-xl bg-white">
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
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Clear
        </button>
        {value && (
          <span className="text-xs text-emerald-600">Signature captured</span>
        )}
      </div>
    </div>
  );
}

type CompanyPhoneNumber = {
  id: number;
  phone_number: string;
  friendly_name: string | null;
  is_primary: boolean;
  capabilities_voice: boolean;
  capabilities_sms: boolean;
  purchased_at: string;
};

type MessagingStatus = {
  provider: string;
  platform_configured: boolean;
  configured: boolean;
  from_number: string | null;
  numbers: CompanyPhoneNumber[];
};

type AvailableNumberRow = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

function formatPhone(p: string): string {
  // Best-effort pretty format for US numbers; falls back to raw E.164.
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  return p;
}

function MessagingPanel() {
  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [areaCode, setAreaCode] = useState("");
  const [contains, setContains] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AvailableNumberRow[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [buyingPhone, setBuyingPhone] = useState<string | null>(null);
  const [actioning, setActioning] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/messaging", { cache: "no-store" });
    if (res.ok) {
      const s = (await res.json()) as MessagingStatus;
      setStatus(s);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setSearching(true);
    setSearchResults(null);
    const params = new URLSearchParams();
    if (areaCode) params.set("area_code", areaCode);
    if (contains) params.set("contains", contains);
    const res = await fetch(`/api/phone-numbers/search?${params.toString()}`, {
      cache: "no-store",
    });
    setSearching(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSearchError(data.error || "Search failed");
      return;
    }
    setSearchResults((await res.json()) as AvailableNumberRow[]);
  }

  async function buy(phoneNumber: string) {
    setError(null);
    setBuyingPhone(phoneNumber);
    const res = await fetch("/api/phone-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phoneNumber }),
    });
    setBuyingPhone(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not buy number");
      return;
    }
    setSearchResults(null);
    setAreaCode("");
    setContains("");
    await load();
  }

  async function makePrimary(id: number) {
    setActioning(id);
    await fetch(`/api/phone-numbers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
    });
    setActioning(null);
    await load();
  }

  async function release(id: number) {
    if (!confirm("Release this number? It cannot be recovered.")) return;
    setActioning(id);
    const res = await fetch(`/api/phone-numbers/${id}`, { method: "DELETE" });
    setActioning(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not release number");
      return;
    }
    await load();
  }

  const platformOk = !!status?.platform_configured;
  const numbers = status?.numbers ?? [];
  const connected = !!status?.configured;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Messaging</h2>
        <p className="text-sm text-slate-500 mt-1">
          Send and receive SMS from the Messages tab. Phone numbers are
          provisioned and managed in-house — pick a number below to get started.
        </p>
      </div>

      <div
        className={
          "flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1 w-fit " +
          (connected
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-slate-100 text-slate-600 border border-slate-200")
        }
      >
        <span
          className={
            "w-1.5 h-1.5 rounded-full " +
            (connected ? "bg-emerald-500" : "bg-slate-400")
          }
        />
        {connected ? "Connected" : "Not connected"}
        {status?.from_number && (
          <span className="text-slate-500 font-normal">
            · {formatPhone(status.from_number)}
          </span>
        )}
      </div>

      {!platformOk && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Platform Twilio credentials are missing on the server. Set the
          <span className="font-mono"> TWILIO_*</span> env vars in your hosting
          environment, then redeploy.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm font-medium text-slate-900">Your numbers</div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : numbers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No phone numbers yet. Search and buy one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {numbers.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between py-2"
              >
                <div className="space-y-0.5">
                  <div className="font-mono text-sm text-slate-900">
                    {formatPhone(n.phone_number)}
                    {n.is_primary && (
                      <span className="ml-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 align-middle">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {n.capabilities_sms ? "SMS" : ""}
                    {n.capabilities_sms && n.capabilities_voice ? " · " : ""}
                    {n.capabilities_voice ? "Voice" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!n.is_primary && (
                    <button
                      type="button"
                      onClick={() => makePrimary(n.id)}
                      disabled={actioning === n.id}
                      className="text-xs bg-white border border-slate-200 hover:bg-slate-100 rounded-full px-3 py-1 font-medium disabled:opacity-50"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => release(n.id)}
                    disabled={actioning === n.id}
                    className="text-xs bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-full px-3 py-1 font-medium disabled:opacity-50"
                  >
                    Release
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={search}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
      >
        <div className="text-sm font-medium text-slate-900">Buy a new number</div>
        <p className="text-xs text-slate-500">
          Search Twilio's catalog of available US local numbers. Numbers are
          billed monthly to the platform account and automatically configured
          for inbound SMS and voice.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <Field label="Area code">
            <input
              type="text"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="843"
              className="w-28 border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono"
            />
          </Field>
          <Field label="Contains">
            <input
              type="text"
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              placeholder="optional"
              className="w-40 border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono"
            />
          </Field>
          <button
            type="submit"
            disabled={searching || !platformOk}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {searchError && (
          <p className="text-sm text-rose-600">{searchError}</p>
        )}

        {searchResults && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {searchResults.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">
                No numbers matched. Try a different area code.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {searchResults.map((r) => (
                  <li
                    key={r.phone_number}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="font-mono text-sm text-slate-900">
                        {formatPhone(r.phone_number)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[r.locality, r.region].filter(Boolean).join(", ") ||
                          "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => buy(r.phone_number)}
                      disabled={buyingPhone === r.phone_number}
                      className="text-xs bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-3 py-1.5 font-medium"
                    >
                      {buyingPhone === r.phone_number ? "Buying…" : "Buy"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

type CallingStatus = {
  platform_configured: boolean;
  configured: boolean;
  has_business_number: boolean;
  business_number: string | null;
  record_calls: boolean;
};

function CallingPanel() {
  const [status, setStatus] = useState<CallingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recordCalls, setRecordCalls] = useState(true);

  async function load() {
    const res = await fetch("/api/settings/voice", { cache: "no-store" });
    if (res.ok) {
      const s = (await res.json()) as CallingStatus;
      setStatus(s);
      setRecordCalls(s.record_calls);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/voice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_calls: recordCalls }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not save");
      return;
    }
    const s = (await res.json()) as CallingStatus;
    setStatus(s);
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Calling</h2>
        <p className="text-sm text-slate-500 mt-1">
          Place and receive calls from the browser using your Twilio number.
          Calls can be recorded automatically and saved to the call log.
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
        {status?.business_number && (
          <span className="text-slate-500 font-normal">
            · {status.business_number}
          </span>
        )}
      </div>

      {!status?.platform_configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Voice is unavailable: platform Twilio credentials are missing on the
          server. Set <span className="font-mono">TWILIO_*</span> env vars and
          redeploy.
        </div>
      )}
      {status?.platform_configured && !status?.has_business_number && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Buy a phone number in <strong>Settings → Messaging</strong> first.
          Outbound calls use your primary number as the caller ID.
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={recordCalls}
          onChange={(e) => setRecordCalls(e.target.checked)}
          className="rounded border-slate-300 text-slate-900 focus:ring-slate-400"
        />
        Record calls
      </label>

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

type EmailStatus = {
  provider: string;
  api_key_set: boolean;
  api_key_prefix: string | null;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  configured: boolean;
};

function EmailPanel() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  async function load() {
    const res = await fetch("/api/settings/email", { cache: "no-store" });
    if (res.ok) {
      const s = (await res.json()) as EmailStatus;
      setStatus(s);
      setFromAddress(s.from_address ?? "");
      setFromName(s.from_name ?? "");
      setReplyTo(s.reply_to ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey || undefined,
        from_address: fromAddress || undefined,
        from_name: fromName,
        reply_to: replyTo,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not save");
      return;
    }
    const s = (await res.json()) as EmailStatus;
    setStatus(s);
    setApiKey("");
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Email</h2>
        <p className="text-sm text-slate-500 mt-1">
          Connect your Resend account to send email blasts to customers,
          subscribers, and prospects.
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
        {status?.from_address && (
          <span className="text-slate-500 font-normal">
            · {status.from_address}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
        <div className="font-medium text-slate-900">Setup steps</div>
        <ol className="list-decimal list-inside space-y-1 text-slate-600">
          <li>
            Sign up at{" "}
            <a
              href="https://resend.com"
              target="_blank"
              rel="noreferrer"
              className="text-slate-900 underline"
            >
              resend.com
            </a>
            .
          </li>
          <li>
            Add your sending domain (e.g. <span className="font-mono">yourcompany.com</span>) in <strong>Resend → Domains</strong>, then add the SPF, DKIM, and DMARC DNS records they show you. Wait a few minutes for verification.
          </li>
          <li>
            In <strong>Resend → API Keys</strong>, create a new API key with{" "}
            <span className="font-mono">Sending access</span>. Copy it (only shown once).
          </li>
          <li>
            Paste below. The <span className="font-mono">From address</span>{" "}
            must be on a verified domain.
          </li>
        </ol>
      </div>

      <Field label="Resend API key">
        <input
          type="password"
          value={apiKey}
          disabled={loading}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono"
          placeholder={
            status?.api_key_set
              ? `${status.api_key_prefix || "re_"}…  (saved)`
              : "re_xxxxxxxxxxxxxxxxxxxxxxxx"
          }
        />
      </Field>
      <Field label="From address">
        <input
          type="email"
          value={fromAddress}
          disabled={loading}
          onChange={(e) => setFromAddress(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="hello@yourcompany.com"
        />
      </Field>
      <Field label="From name">
        <input
          type="text"
          value={fromName}
          disabled={loading}
          onChange={(e) => setFromName(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="Acme Window Cleaning"
        />
      </Field>
      <Field label="Reply-to (optional)">
        <input
          type="email"
          value={replyTo}
          disabled={loading}
          onChange={(e) => setReplyTo(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
          placeholder="support@yourcompany.com"
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

type AiStatus = {
  provider: string;
  api_key_set: boolean;
  api_key_prefix: string | null;
  model: string;
  company_voice: string | null;
  configured: boolean;
};

const AI_MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6 (recommended — fast & cheap)",
  "claude-opus-4-7": "Claude Opus 4.7 (smartest, slower & pricier)",
  "claude-haiku-4-5": "Claude Haiku 4.5 (fastest, cheapest)",
};

function AiPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [voice, setVoice] = useState("");

  async function load() {
    const res = await fetch("/api/settings/ai", { cache: "no-store" });
    if (res.ok) {
      const s = (await res.json()) as AiStatus;
      setStatus(s);
      setModel(s.model || "claude-sonnet-4-6");
      setVoice(s.company_voice ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey || undefined,
        model,
        company_voice: voice,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not save");
      return;
    }
    const s = (await res.json()) as AiStatus;
    setStatus(s);
    setApiKey("");
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">AI</h2>
        <p className="text-sm text-slate-500 mt-1">
          Connect Claude to draft replies in the Messages tab. The AI reads the
          recent conversation and writes a suggested reply you can edit before
          sending.
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
        {status?.configured && status?.model && (
          <span className="text-slate-500 font-normal">· {status.model}</span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
        <div className="font-medium text-slate-900">Setup steps</div>
        <ol className="list-decimal list-inside space-y-1 text-slate-600">
          <li>
            Sign up at{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noreferrer"
              className="text-slate-900 underline"
            >
              console.anthropic.com
            </a>
            .
          </li>
          <li>
            Create an API key under{" "}
            <span className="font-mono">Settings → API Keys</span>. Add credit
            to your account ($5–10 is plenty to start).
          </li>
          <li>Paste the key below and choose a model.</li>
        </ol>
      </div>

      <Field label="Anthropic API key">
        <input
          type="password"
          value={apiKey}
          disabled={loading}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white font-mono"
          placeholder={
            status?.api_key_set
              ? `${status.api_key_prefix || "sk-ant-"}…  (saved)`
              : "sk-ant-api03-…"
          }
        />
      </Field>
      <Field label="Model">
        <select
          value={model}
          disabled={loading}
          onChange={(e) => setModel(e.target.value)}
          className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm bg-white"
        >
          {Object.entries(AI_MODEL_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Company voice (optional)">
        <textarea
          value={voice}
          disabled={loading}
          onChange={(e) => setVoice(e.target.value)}
          rows={4}
          className="w-full border border-slate-200 rounded-2xl px-4 py-2 text-sm bg-white"
          placeholder={
            "e.g. Friendly and concise. Never defensive. If a customer complains, always offer a free re-clean and a callback within 24 hours."
          }
        />
        <p className="text-xs text-slate-400 mt-1">
          Used as part of the prompt for every drafted reply. Describe tone,
          policies, and how you want to handle complaints.
        </p>
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
