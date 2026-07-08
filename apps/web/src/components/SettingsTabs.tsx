"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CustomizationsPanel from "@/components/settings/CustomizationsPanel";
import AccentPicker from "@/components/AccentPicker";
import ThemeToggle from "@/components/ThemeToggle";
import { PulseIcon } from "@/components/pulse/Icon";

type Tab =
  | "profile"
  | "company"
  | "payments"
  | "subscriptions"
  | "customizations"
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
  { key: "customizations", label: "Customizations" },
  { key: "messaging", label: "Messaging" },
  { key: "calling", label: "Calling" },
  { key: "email", label: "Email" },
  { key: "ai", label: "AI" },
  { key: "billing", label: "Billing" },
];

export default function SettingsTabs({
  username,
  initialMe = null,
}: {
  username: string;
  initialMe?: Me | null;
}) {
  return (
    <Suspense fallback={null}>
      <SettingsTabsInner username={username} initialMe={initialMe} />
    </Suspense>
  );
}

function SettingsTabsInner({
  username,
  initialMe,
}: {
  username: string;
  initialMe: Me | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Salespeople and technicians only see the Profile tab — every other
  // settings surface (Company, Payments, Billing, etc.) is admin-only.
  const canSeeAllSettings =
    !!initialMe?.is_admin_account ||
    !!(initialMe as MeWithPerms | null)?.permissions?.includes(
      "settings.view_all"
    );
  const visibleTabs = canSeeAllSettings
    ? TABS
    : TABS.filter((t) => t.key === "profile");
  const initialTab = (() => {
    const t = searchParams.get("tab");
    if (visibleTabs.some((x) => x.key === t)) return t as Tab;
    return "profile";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && visibleTabs.some((x) => x.key === t) && t !== tab) {
      setTab(t as Tab);
    } else if (t && !visibleTabs.some((x) => x.key === t)) {
      setTab("profile");
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
      <div className="border-b border-line">
        <nav className="-mb-px flex gap-6 overflow-x-auto scrollbar-none">
          {visibleTabs.map((t) => {
            const active = tab === t.key;
            return (
              <Button
                key={t.key}
                variant="ghost"
                onClick={() => changeTab(t.key)}
                className={
                  "h-auto rounded-none whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-bold hover:bg-transparent " +
                  (active
                    ? "border-slate-900 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-300")
                }
              >
                {t.label}
              </Button>
            );
          })}
        </nav>
      </div>

      <div className="bg-card border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
        {tab === "profile" && (
          <ProfilePanel username={username} initialMe={initialMe} />
        )}
        {canSeeAllSettings && tab === "company" && <CompanyPanel />}
        {canSeeAllSettings && tab === "payments" && <PaymentsPanel />}
        {canSeeAllSettings && tab === "subscriptions" && <SubscriptionsPanel />}
        {canSeeAllSettings && tab === "customizations" && <CustomizationsPanel />}
        {canSeeAllSettings && tab === "messaging" && <MessagingPanel />}
        {canSeeAllSettings && tab === "calling" && <CallingPanel />}
        {canSeeAllSettings && tab === "email" && <EmailPanel />}
        {canSeeAllSettings && tab === "ai" && <AiPanel />}
        {canSeeAllSettings && tab === "billing" && <BillingPanel />}
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
  permissions?: string[];
};

type MeWithPerms = Me & { permissions?: string[] };

const PERMISSION_LABELS: Record<string, string> = {
  admin: "Admin",
  salesperson: "Salesperson",
  technician: "Technician",
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

function ProfilePanel({
  username,
  initialMe,
}: {
  username: string;
  initialMe: Me | null;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(initialMe);
  // If the server seeded us, we already have the row — skip the loading
  // spinner and the redundant client fetch.
  const [loading, setLoading] = useState(initialMe == null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initialMe?.staff?.photo_url ?? null
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMe) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Me | null) => {
        setMe(m);
        setPhotoUrl(m?.staff?.photo_url ?? null);
      })
      .finally(() => setLoading(false));
  }, [initialMe]);

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
      // Refresh the server layout so the sidebar avatar (rendered from the
      // layout's loadMe()) picks up the new photo without a manual reload.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const staff = me?.staff;
  const displayName =
    staff?.name?.trim() ||
    (me?.is_admin_account ? "Admin" : me?.identity || username || "—");
  const firstName = staff?.first_name?.trim() || "—";
  const lastName = staff?.last_name?.trim() || "—";
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
        <h2 className="text-lg font-extrabold text-white tracking-tight">Profile</h2>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Your account information.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <div className="flex items-start gap-5">
            <div className="w-[120px] h-[120px] rounded-2xl bg-black border border-line flex items-center justify-center overflow-hidden shrink-0">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl text-zinc-500">
                  {(displayName[0] || "?").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoBusy || isAdminEnv}
                  className="h-auto text-sm border border-line-strong hover:border-slate-400 rounded-full px-4 py-2 text-zinc-300 hover:bg-transparent"
                >
                  {photoBusy
                    ? "Loading…"
                    : photoUrl
                    ? "Change photo"
                    : "Add photo"}
                </Button>
                {photoUrl && !isAdminEnv && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="h-auto text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
                  >
                    Remove
                  </Button>
                )}
              </div>
              {isAdminEnv && (
                <p className="text-xs font-bold text-zinc-500">
                  This is the built-in admin account. Create an employee record to
                  manage your own profile.
                </p>
              )}
              {photoError && (
                <p className="text-xs text-rose-600">{photoError}</p>
              )}
              {dirty && !isAdminEnv && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-4 py-2 font-bold"
                >
                  {saving ? "Saving…" : "Save photo"}
                </Button>
              )}
              {savedAt && !saving && !dirty && (
                <p className="text-xs text-emerald-600">Saved</p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadOnlyField label="First name" value={firstName} />
            <ReadOnlyField label="Last name" value={lastName} />
            <ReadOnlyField label="Email" value={email} />
            <ReadOnlyField label="Role" value={role} />
          </dl>

          {!isAdminEnv && (
            <p className="text-xs font-bold text-zinc-500">
              To change your name, email, or password, edit your record from
              the <span className="font-bold">Employees</span> page.
            </p>
          )}

          <div className="pt-6 border-t border-line">
            <div className="text-sm font-bold text-white mb-1">Appearance</div>
            <p className="text-xs font-bold text-zinc-500 mb-3">
              Light mode improves outdoor and map readability. Saved on this
              device.
            </p>
            <div className="max-w-[220px] rounded-lg border border-line">
              <ThemeToggle />
            </div>
          </div>
          <div className="pt-6 border-t border-line">
            <AccentPicker />
          </div>
        </>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-zinc-500 mb-1">
        {label}
      </dt>
      <dd className="text-sm font-bold text-white tracking-tight bg-black border border-line rounded-full px-4 py-2">
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
  email: string | null;
  website: string | null;
  logo_url: string | null;
};

async function processLogoImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = objectUrl;
    });
    const MAX = 512;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, w, h);
    const isPng = file.type === "image/png";
    return isPng
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function CompanyPanel() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Company | null) => {
        if (c) {
          setName(c.name ?? "");
          setAddress(c.address ?? "");
          setPhone(c.phone ?? "");
          setEmail(c.email ?? "");
          setWebsite(c.website ?? "");
          setLogoUrl(c.logo_url ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setLogoError("Image is too large (max 8 MB)");
      return;
    }
    setLogoBusy(true);
    try {
      const dataUrl = await processLogoImage(file);
      setLogoUrl(dataUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Could not load image");
    } finally {
      setLogoBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    let res: Response;
    try {
      res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          phone,
          email,
          website,
          logo_url: logoUrl,
        }),
      });
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Network error");
      return;
    }
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || `Could not save (${res.status})`);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-white tracking-tight">Company</h2>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Information that appears on invoices, estimates, subscriptions, and
          other customer-facing materials.
        </p>
      </div>

      <Field label="Logo">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-xl border border-line bg-card flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-zinc-500">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={onPickLogo}
              className="hidden"
            />
            <Button
              variant="ghost"
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={loading || logoBusy}
              className="h-auto text-sm bg-card border border-line hover:bg-black rounded-full px-4 py-2 font-bold w-fit"
            >
              {logoBusy ? "Processing…" : logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setLogoUrl(null)}
                disabled={loading || logoBusy}
                className="h-auto text-xs text-rose-400 hover:text-rose-300 hover:bg-transparent font-bold w-fit px-0"
              >
                Remove logo
              </Button>
            )}
            {logoError && (
              <p className="text-xs text-rose-500">{logoError}</p>
            )}
          </div>
        </div>
      </Field>

      <Field label="Company name">
        <Input
          type="text"
          value={name}
          disabled={loading}
          onChange={(e) => setName(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="Acme Window Cleaning"
        />
      </Field>
      <Field label="Address">
        <Input
          type="text"
          value={address}
          disabled={loading}
          onChange={(e) => setAddress(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="123 Main St, Springfield, IL"
        />
      </Field>
      <Field label="Phone">
        <Input
          type="tel"
          value={phone}
          disabled={loading}
          onChange={(e) => setPhone(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="(555) 555-5555"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="hello@acme.com"
        />
      </Field>
      <Field label="Website">
        <Input
          type="url"
          value={website}
          disabled={loading}
          onChange={(e) => setWebsite(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="https://acme.com"
        />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          type="submit"
          disabled={saving || loading}
          className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
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
  // Set when the previously-connected account was inaccessible and we
  // auto-cleared the stored ID so the merchant can reconnect.
  recovered_from?: string;
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
        <h2 className="text-lg font-extrabold text-white tracking-tight">Payments</h2>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Connect a Stripe account to accept card payments. Money is paid out
          to the bank account on file with Stripe.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !status?.configured ? (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl px-4 py-3">
          <p className="text-sm text-amber-800 font-bold">
            Stripe platform keys aren&apos;t configured.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Add <code>STRIPE_SECRET_KEY</code> and{" "}
            <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to the deployment
            environment, then redeploy.
          </p>
        </div>
      ) : !status.connected ? (
        <div className="border border-line rounded-2xl px-4 py-4 space-y-4">
          {status.recovered_from && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-800 font-bold">
              {status.recovered_from}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white tracking-tight">
              No Stripe account connected
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Already use Stripe? Sign in to connect your existing account.
              Otherwise, create a new one — we&apos;ll guide you through bank
              and ID verification in a few minutes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={startConnect}
              disabled={working}
              className="h-auto text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
            >
              {working ? "Opening Stripe…" : "Create new Stripe account"}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={startOAuth}
              disabled={working || !status.oauth_configured}
              title={
                status.oauth_configured
                  ? undefined
                  : "Set STRIPE_CONNECT_CLIENT_ID to enable sign-in"
              }
              className="h-auto text-sm border border-line-strong bg-card hover:bg-black disabled:bg-black disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-300 rounded-full px-5 py-2 font-bold"
            >
              Sign in to existing Stripe
            </Button>
          </div>
          {!status.oauth_configured && (
            <p className="text-xs font-bold text-zinc-500">
              The &ldquo;Sign in&rdquo; option is unavailable until{" "}
              <code>STRIPE_CONNECT_CLIENT_ID</code> is set in the deployment
              environment.
            </p>
          )}
        </div>
      ) : (
        <div className="border border-line rounded-2xl px-5 py-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <p className="text-base font-bold text-white tracking-tight">
                  {status.business_name ||
                    status.email ||
                    "Stripe account"}
                </p>
                <Badge
                  className={
                    status.charges_enabled
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  }
                >
                  {status.charges_enabled ? "Connected" : "Pending"}
                </Badge>
              </div>
              {status.business_name && status.email && (
                <p className="text-xs text-zinc-400 font-bold">
                  {status.email}
                </p>
              )}
              {status.account_id && (
                <p className="text-xs text-zinc-500 font-bold">
                  <span className="text-zinc-600">Account ID</span>{" "}
                  <span className="font-mono text-zinc-400">
                    {status.account_id}
                  </span>
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              type="button"
              onClick={load}
              className="h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent"
              title="Re-check status"
            >
              Refresh
            </Button>
          </div>

          {(!status.charges_enabled ||
            !status.payouts_enabled ||
            status.requirements_due) && (
            <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl px-3 py-3 space-y-2">
              <p className="text-xs text-amber-200 font-bold">
                Stripe still needs more information before this account can
                accept payments or receive payouts.
              </p>
              <Button
                variant="ghost"
                type="button"
                onClick={startConnect}
                disabled={working}
                className="h-auto text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-full px-3 py-1.5 font-bold"
              >
                {working ? "Opening Stripe…" : "Finish onboarding"}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://dashboard.stripe.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open Stripe dashboard ↗
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={disconnect}
              disabled={working}
              className="text-rose-400 hover:text-rose-300 hover:bg-transparent"
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
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
  service_interval: SubscriptionInterval;
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
  service_interval: SubscriptionInterval;
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
  service_interval: SubscriptionInterval;
};

function emptyForm(): TemplateForm {
  return {
    name: "",
    description: "",
    active: true,
    terms_id: null,
    require_signature: false,
    service_interval: "monthly",
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
      service_interval: t.service_interval || "monthly",
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
      service_interval: form.service_interval,
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
      const text = await res.text().catch(() => "");
      let serverMsg = "";
      try {
        const j = JSON.parse(text) as { error?: string };
        serverMsg = j.error || "";
      } catch {
        serverMsg = text.slice(0, 240);
      }
      setError(
        serverMsg
          ? `Could not save template: ${serverMsg}`
          : `Could not save template (HTTP ${res.status})`
      );
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
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Subscriptions
          </h2>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Create subscription templates to send to customers or accept on a
            customer&apos;s device.
          </p>
        </div>
        {editingId === null && (
          <Button
            variant="ghost"
            onClick={startNew}
            className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-4 py-2 font-bold"
          >
            New template
          </Button>
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
          className="space-y-4 rounded-xl border border-line bg-black p-4"
        >
          <h3 className="text-sm font-extrabold text-white tracking-tight">
            {editingId === "new" ? "New template" : "Edit template"}
          </h3>
          <Field label="Name">
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
              placeholder="Monthly Window Cleaning"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full border-line rounded-2xl px-4 py-2 text-sm bg-card"
              placeholder="Includes interior + exterior windows…"
            />
          </Field>
          <Field label="Service frequency">
            {/* Native <select> kept: Radix Select forbids empty-string item values; preserved for consistency with other selects on this surface. */}
            <select
              value={form.service_interval}
              onChange={(e) =>
                setForm({
                  ...form,
                  service_interval: e.target.value as SubscriptionInterval,
                })
              }
              className="w-full border border-line rounded-full px-4 py-2 text-sm bg-card"
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
          <p className="text-xs text-zinc-400 -mt-1">
            How often the service is delivered. Price and billing frequency
            are set per customer when you create a subscription from this
            template.
          </p>
          <div className="space-y-3 pt-2 border-t border-line">
            <div>
              <Label className="block mb-1 text-white tracking-tight">
                Terms
              </Label>
              <p className="text-xs text-zinc-400 mb-2">
                Optional terms shown to the customer when this subscription
                is sent or accepted.
              </p>
              {/* Native <select> kept: Radix Select forbids empty-string item values, breaking the "Select terms (optional)" sentinel. */}
              <select
                value={form.terms_id ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    terms_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full border border-line rounded-full px-4 py-2 text-sm bg-card"
              >
                <option value="">Select terms (optional)</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="h-auto mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-transparent"
              >
                Create new terms +
              </Button>
            </div>
            <Label className="inline-flex items-center gap-3 text-zinc-300">
              <span>Require signature</span>
              <Button
                variant="ghost"
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
                  "relative h-5 w-9 shrink-0 items-center rounded-full p-0 " +
                  (form.require_signature
                    ? "bg-indigo-600 hover:bg-indigo-600"
                    : "bg-line-strong hover:bg-line-strong")
                }
              >
                <span
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-card transition " +
                    (form.require_signature ? "translate-x-4" : "translate-x-0.5")
                  }
                />
              </Button>
            </Label>
          </div>
          <Label className="inline-flex items-center gap-2 text-zinc-300">
            <Checkbox
              checked={form.active}
              onCheckedChange={(c) => setForm({ ...form, active: c === true })}
            />
            Active
          </Label>
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="ghost"
              type="submit"
              disabled={saving}
              className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
            >
              {saving ? "Saving…" : "Save template"}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={cancelEdit}
              className="h-auto text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div>
        <h3 className="text-sm font-extrabold text-white tracking-tight mb-3">
          Templates
        </h3>
        {loading && templates.length === 0 ? (
          <p className="text-sm text-zinc-400 font-bold">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-zinc-400 font-bold">
            No templates yet. Create one to get started.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-tight truncate">
                      {t.name}
                    </span>
                    {t.active === 0 && (
                      <span className="text-[10px] font-bold text-zinc-400 bg-black rounded-full px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Service: {INTERVAL_LABELS[t.service_interval || "monthly"].toLowerCase()}
                    {" · "}price &amp; billing set per customer
                  </div>
                  {t.description && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                      {t.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    onClick={() => setActionTpl(t)}
                    disabled={t.active === 0}
                    className="h-auto text-xs bg-primary hover:opacity-90 disabled:bg-line-strong text-primary-foreground rounded-full px-3 py-1.5 font-bold"
                  >
                    Send / Accept
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => startEdit(t)}
                    className="h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => deleteTemplate(t.id)}
                    className="h-auto text-xs text-rose-600 hover:text-rose-700 hover:bg-transparent"
                  >
                    Delete
                  </Button>
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

  const [cancelTarget, setCancelTarget] = useState<CustomerSubscription | null>(
    null
  );

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

  async function cancelSubscription(
    id: number,
    mode: "all_future" | "keep_next"
  ) {
    const res = await fetch(`/api/customer-subscriptions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled", cancel_mode: mode }),
    });
    if (res.ok) {
      setCancelTarget(null);
      await onChange();
    }
  }

  return (
    <div>
      <h3 className="text-sm font-extrabold text-white tracking-tight mb-3">
        Recent subscriptions
      </h3>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {subscriptions.slice(0, 10).map((s) => {
          const cust = customerMap.get(s.customer_id);
          return (
            <li
              key={s.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white tracking-tight truncate">
                  {cust?.name || `Customer #${s.customer_id}`}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {s.name} · {formatPrice(s.price_cents)} /{" "}
                  {INTERVAL_LABELS[s.interval].toLowerCase()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={s.status} />
                {s.status === "pending" && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => updateStatus(s.id, "active")}
                      className="h-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-3 py-1.5 font-bold"
                    >
                      Mark accepted
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => updateStatus(s.id, "declined")}
                      className="h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent"
                    >
                      Decline
                    </Button>
                  </>
                )}
                {s.status === "active" && (
                  <Button
                    variant="ghost"
                    onClick={() => setCancelTarget(s)}
                    className="h-auto text-xs text-rose-600 hover:text-rose-700 hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {cancelTarget && (
        <CancelSubscriptionModal
          subscription={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={(mode) => cancelSubscription(cancelTarget.id, mode)}
        />
      )}
    </div>
  );
}

function CancelSubscriptionModal({
  subscription,
  onClose,
  onConfirm,
}: {
  subscription: CustomerSubscription;
  onClose: () => void;
  onConfirm: (mode: "all_future" | "keep_next") => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"all_future" | "keep_next">("all_future");
  const [submitting, setSubmitting] = useState(false);

  async function go() {
    setSubmitting(true);
    await onConfirm(mode);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">
              Cancel subscription
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {subscription.name} · {formatPrice(subscription.price_cents)} /{" "}
              {INTERVAL_LABELS[subscription.interval].toLowerCase()}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto text-sm text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          >
            ✕
          </Button>
        </div>
        <p className="text-xs text-zinc-400">
          Past visits and their payment records stay intact. Pick how to
          handle the upcoming visits already on the schedule.
        </p>
        <div className="space-y-2">
          <Label className="block w-full rounded-xl border border-line hover:border-line-strong p-3 cursor-pointer">
            {/* Native <input type="radio"> kept: no Radio primitive in design system. */}
            <input
              type="radio"
              name="cancel-mode"
              checked={mode === "all_future"}
              onChange={() => setMode("all_future")}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <span
                className={
                  "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 " +
                  (mode === "all_future"
                    ? "border-slate-200"
                    : "border-line-strong")
                }
              >
                {mode === "all_future" && (
                  <span className="m-auto h-2 w-2 rounded-full bg-slate-200" />
                )}
              </span>
              <div>
                <div className="text-sm font-bold text-white tracking-tight">
                  Cancel all future visits
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Every upcoming subscription visit on the schedule is
                  canceled.
                </div>
              </div>
            </div>
          </Label>
          <Label className="block w-full rounded-xl border border-line hover:border-line-strong p-3 cursor-pointer">
            <input
              type="radio"
              name="cancel-mode"
              checked={mode === "keep_next"}
              onChange={() => setMode("keep_next")}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <span
                className={
                  "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 " +
                  (mode === "keep_next"
                    ? "border-slate-200"
                    : "border-line-strong")
                }
              >
                {mode === "keep_next" && (
                  <span className="m-auto h-2 w-2 rounded-full bg-slate-200" />
                )}
              </span>
              <div>
                <div className="text-sm font-bold text-white tracking-tight">
                  Keep the next visit, cancel everything after
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Useful when the upcoming visit is already prepped or the
                  customer expects it.
                </div>
              </div>
            </div>
          </Label>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="ghost"
            onClick={go}
            disabled={submitting}
            className="h-auto text-sm bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-full px-5 py-2 font-bold"
          >
            {submitting ? "Canceling…" : "Cancel subscription"}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
          >
            Keep active
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CustomerSubscription["status"] }) {
  const styles: Record<CustomerSubscription["status"], string> = {
    pending: "bg-amber-100 text-amber-800",
    active: "bg-emerald-100 text-emerald-800",
    declined: "bg-black text-zinc-400",
    canceled: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={
        "text-[10px] font-bold rounded-full px-2 py-0.5 " +
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
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {template.name}
            </h3>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto text-sm text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          >
            ✕
          </Button>
        </div>

        {template.description && (
          <p className="text-sm text-zinc-400 font-bold whitespace-pre-wrap">
            {template.description}
          </p>
        )}

        <p className="text-xs text-zinc-400">
          Service frequency:{" "}
          <span className="font-bold text-white tracking-tight">
            {INTERVAL_LABELS[template.service_interval || "monthly"]}
          </span>
        </p>

        <Field label="Customer">
          {/* Native <select> kept: Radix Select forbids empty-string item values, breaking the "Select customer…" sentinel. */}
          <select
            value={customerId}
            onChange={(e) =>
              setCustomerId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full border border-line rounded-full px-4 py-2 text-sm bg-card"
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
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="49.00"
              className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
            />
          </Field>
          <Field label="Billing interval">
            {/* Native <select> kept: Radix Select forbids empty-string item values; preserved for consistency with the customer select sentinel pattern. */}
            <select
              value={interval}
              onChange={(e) =>
                setInterval(e.target.value as SubscriptionInterval)
              }
              className="w-full border border-line rounded-full px-4 py-2 text-sm bg-card"
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
            <div className="text-xs font-bold text-zinc-500 mb-1.5">
              Terms — {linkedTerms.name}
            </div>
            <div className="text-xs text-zinc-300 bg-black border border-line rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {linkedTerms.body}
            </div>
          </div>
        )}

        {requireSignature && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-500">
              Customer signature
            </div>
            <SignaturePad value={signatureData} onChange={setSignatureData} />
            <Input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Printed name"
              className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
            />
            <p className="text-[11px] text-zinc-500">
              Required for &quot;Accept on device&quot;. Not needed for
              &quot;Send to customer&quot; — the customer will sign on their end.
            </p>
          </div>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => submit("send")}
            disabled={submitting}
            className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-4 py-2 font-bold flex-1"
          >
            Send to customer
          </Button>
          <Button
            variant="ghost"
            onClick={() => submit("accept")}
            disabled={submitting}
            className="h-auto text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-full px-4 py-2 font-bold flex-1"
          >
            Accept on device
          </Button>
        </div>
        <p className="text-xs font-bold text-zinc-500">
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
        className="bg-card rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-extrabold text-white tracking-tight">New terms</h3>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="h-auto text-sm text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          >
            ✕
          </Button>
        </div>
        <Field label="Name">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Standard subscription terms"
            className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
            autoFocus
          />
        </Field>
        <Field label="Body">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Enter the full terms the customer will see and sign…"
            className="w-full border-line rounded-2xl px-4 py-2 text-sm bg-card font-mono"
          />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="ghost"
            type="submit"
            disabled={saving}
            className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
          >
            {saving ? "Saving…" : "Save terms"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="h-auto text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
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
          variant="ghost"
          type="button"
          onClick={clear}
          className="h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent"
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

function formatUSPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return e164;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

type RegistrationStatus = {
  registration: {
    legal_company_name: string;
    dba: string | null;
    ein: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    region: string;
    postal_code: string;
    iso_country: string;
    business_email: string;
    business_phone: string;
    business_website: string | null;
    industry: string;
    monthly_volume: "under_1k" | "1k_6k" | "6k_plus";
    business_description: string;
    auth_rep_name: string;
    auth_rep_title: string;
    auth_rep_email: string;
    submitted_at: string | null;
  } | null;
  company: {
    sms_tier: "trial" | "paid_pending_registration" | "paid_approved";
    a2p_registration_state: string;
    a2p_registration_error: string | null;
    a2p_registration_started_at: string | null;
    a2p_registration_approved_at: string | null;
    sms_dedicated_number: string | null;
    twilio_brand_sid: string | null;
    twilio_campaign_sid: string | null;
  };
};

const STATE_LABELS: Record<string, string> = {
  not_started: "Not submitted",
  customer_profile_pending: "Customer profile in review",
  customer_profile_approved: "Customer profile approved",
  customer_profile_failed: "Customer profile rejected",
  trust_product_pending: "Trust product in review",
  trust_product_approved: "Trust product approved",
  trust_product_failed: "Trust product rejected",
  brand_pending: "Brand registration in review",
  brand_approved: "Brand approved",
  brand_failed: "Brand registration rejected",
  campaign_pending: "Campaign in review",
  campaign_approved: "Campaign approved",
  campaign_failed: "Campaign rejected",
};

function MessagingPanel() {
  const [data, setData] = useState<RegistrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    legal_company_name: "",
    dba: "",
    ein: "",
    address_line1: "",
    address_line2: "",
    city: "",
    region: "",
    postal_code: "",
    iso_country: "US",
    business_email: "",
    business_phone: "",
    business_website: "",
    industry: "",
    monthly_volume: "under_1k" as "under_1k" | "1k_6k" | "6k_plus",
    business_description: "",
    auth_rep_name: "",
    auth_rep_title: "",
    auth_rep_email: "",
    confirmed_authorized: false,
    confirmed_aup_tcpa: false,
    confirmed_consent: false,
  });

  async function load(refresh = false) {
    const res = await fetch(
      `/api/sms/registration${refresh ? "?refresh=1" : ""}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const s = (await res.json()) as RegistrationStatus;
      setData(s);
      if (s.registration) {
        setForm((f) => ({
          ...f,
          legal_company_name: s.registration!.legal_company_name,
          dba: s.registration!.dba ?? "",
          ein: s.registration!.ein,
          address_line1: s.registration!.address_line1,
          address_line2: s.registration!.address_line2 ?? "",
          city: s.registration!.city,
          region: s.registration!.region,
          postal_code: s.registration!.postal_code,
          iso_country: s.registration!.iso_country,
          business_email: s.registration!.business_email,
          business_phone: s.registration!.business_phone,
          business_website: s.registration!.business_website ?? "",
          industry: s.registration!.industry,
          monthly_volume: s.registration!.monthly_volume,
          business_description: s.registration!.business_description,
          auth_rep_name: s.registration!.auth_rep_name,
          auth_rep_title: s.registration!.auth_rep_title,
          auth_rep_email: s.registration!.auth_rep_email,
        }));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const company = data?.company;
  const state = company?.a2p_registration_state ?? "not_started";
  const isApproved = state === "campaign_approved";
  const isPending = [
    "customer_profile_pending",
    "trust_product_pending",
    "brand_pending",
    "campaign_pending",
  ].includes(state);
  const isFailed = [
    "customer_profile_failed",
    "trust_product_failed",
    "brand_failed",
    "campaign_failed",
  ].includes(state);
  const editable = !isPending; // allow edit + resubmit when not_started or failed
  const submitted = !!data?.registration?.submitted_at;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/sms/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not submit");
      return;
    }
    const s = (await res.json()) as RegistrationStatus;
    setData(s);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Phone &amp; Messaging
          </h2>
          <p className="text-sm text-zinc-400 mt-2 font-bold">
            {isApproved
              ? "Two-way texting is enabled on your dedicated business number."
              : "Complete your 10DLC registration to start sending text messages to customers."}
          </p>
        </div>
        <TierBadge isApproved={isApproved} isPending={isPending} />
      </div>

      {!isApproved && (
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/30 p-4 flex gap-3">
          <PulseIcon name="message" className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-extrabold text-white">
              Trial Plan: One-Way Texting Only
            </div>
            <p className="text-sm text-indigo-200/80 mt-1">
              Outgoing texts are sent from a shared pool of numbers we
              provision. Customer replies won&apos;t reach you while on a
              trial. Upgrade to a paid plan to activate two-way texting with a
              dedicated business number.
            </p>
          </div>
        </div>
      )}

      {isApproved && company?.sms_dedicated_number && (
        <div className="rounded-xl border border-line bg-black p-4">
          <div className="text-xs font-bold text-zinc-500">Your number</div>
          <div className="mt-1 text-2xl font-black text-white font-mono tabular-nums tracking-tight">
            {formatUSPhone(company.sms_dedicated_number)}
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-bold">
            Active. Two-way SMS routed through this number.
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-card p-5 space-y-5">
        <div className="flex items-center gap-3">
          <PulseIcon name="message" className="w-5 h-5 text-zinc-400 shrink-0" />
          <div>
            <div className="text-base font-extrabold text-white">
              10DLC Registration
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Required to send text messages to your customers
            </div>
          </div>
        </div>

        {!submitted && (
          <div className="rounded-lg border border-line bg-black/40 p-4 text-sm text-zinc-300 space-y-2">
            <p>
              To send text messages to your customers, businesses must
              register their 10-digit long code (10DLC) phone numbers with
              carriers. Failure to register will result in message filtering
              and eventual blocking.
            </p>
            <div className="font-bold text-white">Action Needed:</div>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>
                <span className="font-bold text-zinc-200">
                  Complete the registration form below:
                </span>{" "}
                Provide the necessary details for us to register your
                business. Approval typically takes 1 to 7 days.
              </li>
              <li>
                <span className="font-bold text-zinc-200">Stay informed:</span>{" "}
                We&apos;ll reach out via email if additional information is
                needed or if there are issues with your registration.
              </li>
            </ol>
          </div>
        )}

        {(isPending || isApproved || isFailed) && (
          <RegistrationStatusCard
            state={state}
            error={company?.a2p_registration_error ?? null}
            submittedAt={data?.registration?.submitted_at ?? null}
            approvedAt={company?.a2p_registration_approved_at ?? null}
            onRefresh={() => load(true)}
          />
        )}

        {editable && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Legal Company Name">
              <Input
                value={form.legal_company_name}
                onChange={(e) => set("legal_company_name", e.target.value)}
                disabled={loading || saving}
                className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <Field label="DBA or Trade Name (optional)">
              <Input
                value={form.dba}
                onChange={(e) => set("dba", e.target.value)}
                disabled={loading || saving}
                className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <Field label="EIN (format XX-XXXXXXX)">
              <Input
                value={form.ein}
                onChange={(e) => set("ein", e.target.value)}
                disabled={loading || saving}
                placeholder="12-3456789"
                className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card font-mono"
              />
            </Field>
            <Field label="Business Address">
              <Input
                value={form.address_line1}
                onChange={(e) => set("address_line1", e.target.value)}
                disabled={loading || saving}
                placeholder="Street address"
                className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City">
                <Input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  disabled={loading || saving}
                  className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
                />
              </Field>
              <Field label="State">
                <Input
                  value={form.region}
                  onChange={(e) => set("region", e.target.value.toUpperCase())}
                  disabled={loading || saving}
                  placeholder="SC"
                  maxLength={2}
                  className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card uppercase"
                />
              </Field>
              <Field label="Postal Code">
                <Input
                  value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                  disabled={loading || saving}
                  className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Business Email">
                <Input
                  type="email"
                  value={form.business_email}
                  onChange={(e) => set("business_email", e.target.value)}
                  disabled={loading || saving}
                  className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
                />
              </Field>
              <Field label="Business Phone">
                <Input
                  type="tel"
                  value={form.business_phone}
                  onChange={(e) => set("business_phone", e.target.value)}
                  disabled={loading || saving}
                  placeholder="+1 555 555 1234"
                  className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
                />
              </Field>
            </div>
            <Field label="Business Website">
              <Input
                value={form.business_website}
                onChange={(e) => set("business_website", e.target.value)}
                disabled={loading || saving}
                placeholder="https://example.com or social media URL"
                className="h-auto w-full border-line rounded-lg px-3 py-2 text-sm bg-card"
              />
            </Field>

            <div className="space-y-2 pt-2">
              <label className="flex items-start gap-2 text-sm text-zinc-300 cursor-pointer">
                <Checkbox
                  checked={form.confirmed_authorized}
                  onCheckedChange={(v) =>
                    set("confirmed_authorized", v === true)
                  }
                />
                <span>
                  I am authorized to register this business with carriers.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-300 cursor-pointer">
                <Checkbox
                  checked={form.confirmed_aup_tcpa}
                  onCheckedChange={(v) =>
                    set("confirmed_aup_tcpa", v === true)
                  }
                />
                <span>
                  I agree to the SMS Acceptable Use Policy and the TCPA.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-300 cursor-pointer">
                <Checkbox
                  checked={form.confirmed_consent}
                  onCheckedChange={(v) =>
                    set("confirmed_consent", v === true)
                  }
                />
                <span>
                  Every recipient I will text has provided express consent.
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-rose-500">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="ghost"
                disabled={saving || loading}
                className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
              >
                {saving
                  ? "Submitting…"
                  : isFailed
                  ? "Resubmit Registration"
                  : "Submit Registration"}
              </Button>
              {submitted && !isFailed && (
                <span className="text-xs text-zinc-500">
                  Last submitted{" "}
                  {data?.registration?.submitted_at?.slice(0, 19).replace("T", " ")}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TierBadge({
  isApproved,
  isPending,
}: {
  isApproved: boolean;
  isPending: boolean;
}) {
  if (isApproved) {
    return (
      <span className="text-xs font-bold rounded-full px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        SMS: Two-way active
      </span>
    );
  }
  if (isPending) {
    return (
      <span className="text-xs font-bold rounded-full px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        SMS: Pending review
      </span>
    );
  }
  return (
    <span className="text-xs font-bold rounded-full px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      SMS: One-way only
    </span>
  );
}

function RegistrationStatusCard({
  state,
  error,
  submittedAt,
  approvedAt,
  onRefresh,
}: {
  state: string;
  error: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  onRefresh: () => void;
}) {
  const isFailed = state.endsWith("_failed");
  const isApproved = state === "campaign_approved";
  return (
    <div
      className={
        "rounded-lg border p-4 text-sm space-y-1 " +
        (isFailed
          ? "border-rose-900/40 bg-rose-950/30 text-rose-100"
          : isApproved
          ? "border-emerald-900/40 bg-emerald-950/30 text-emerald-100"
          : "border-line bg-black/40 text-zinc-200")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-bold">{STATE_LABELS[state] ?? state}</div>
        <Button
          type="button"
          variant="ghost"
          onClick={onRefresh}
          className="h-auto text-xs underline font-bold hover:bg-transparent"
        >
          Refresh status
        </Button>
      </div>
      {submittedAt && (
        <div className="text-xs opacity-70">
          Submitted {submittedAt.slice(0, 19).replace("T", " ")}
        </div>
      )}
      {approvedAt && (
        <div className="text-xs opacity-70">
          Approved {approvedAt.slice(0, 19).replace("T", " ")}
        </div>
      )}
      {error && (
        <div className="mt-2 text-xs opacity-80 font-mono break-all">
          {error}
        </div>
      )}
    </div>
  );
}


type CallingStatus = {
  api_key_sid_masked: string | null;
  api_key_secret_set: boolean;
  twiml_app_sid_masked: string | null;
  record_calls: boolean;
  configured: boolean;
  has_account_credentials: boolean;
  has_business_number: boolean;
  business_number: string | null;
  has_dedicated_number: boolean;
  dedicated_number: string | null;
  capability_verified: boolean;
  caller_id_name: string | null;
  has_voicemail_greeting: boolean;
  a2p_approved: boolean;
};

function CallingPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<CallingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings/voice", { cache: "no-store" });
    if (res.ok) {
      const s = (await res.json()) as CallingStatus;
      setStatus(s);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function checkCapability() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/voice/check-capability", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        voice?: boolean;
        error?: string;
      };
      if (!res.ok) setError(data.error || "Capability check failed");
      else if (!data.voice)
        setError("This number does not support voice calling.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function enableCalling() {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/settings/voice/enable", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Could not enable calling (HTTP ${res.status})`);
      } else {
        setStatusMsg("Re-sync complete -- Twilio webhook updated.");
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disableCalling() {
    if (!confirm("Remove phone calling? You can re-enable any time.")) return;
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      await fetch("/api/settings/voice/disable", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading…</p>;
  }
  if (!status) {
    return (
      <p className="text-sm text-rose-500">Could not load calling status.</p>
    );
  }

  // Calling rides on the 10DLC-approved number. Until the campaign is
  // approved AND a number has actually been provisioned, no other state is
  // valid -- a stale messaging_settings row could otherwise have us showing
  // Active for a number that doesn't exist on Twilio, which is what kept
  // producing "application error" on inbound calls.
  const noNumber = !status.a2p_approved;
  const number = status.dedicated_number;
  const verified = status.capability_verified;
  const enabled = status.configured && status.a2p_approved;
  const displayNumber = number ? formatUSPhone(number) : "";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-white tracking-tight">
          Phone Calling
        </h2>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Enable inbound and outbound calling on your business number.
        </p>
      </div>

      {noNumber && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
          <p className="font-bold">Complete 10DLC registration first.</p>
          <p className="text-amber-800">
            Calling reuses your approved business number. Finish the
            registration in <strong>Settings → Messaging</strong> to claim a
            dedicated number, then come back here to enable calling.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.replace("/settings?tab=messaging")}
            className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-4 py-2 font-bold"
          >
            Go to Messaging
          </Button>
        </div>
      )}

      {!noNumber && !enabled && !verified && (
        <div className="rounded-xl border border-line bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-black border border-line flex items-center justify-center">
              <PulseIcon name="phone" className="w-5 h-5 text-zinc-300" />
            </span>
            <div>
              <div className="text-base font-extrabold text-white tracking-tight">
                Phone Calling
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Enable inbound and outbound calling on your business number
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-black/40 p-4 space-y-3">
            <p className="text-sm text-zinc-300">
              Before enabling calling, we need to verify your number{" "}
              <span className="font-bold text-white">{displayNumber}</span>{" "}
              supports voice.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={checkCapability}
              disabled={busy}
              className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
            >
              {busy ? "Checking…" : "Check Voice Capability"}
            </Button>
          </div>
        </div>
      )}

      {!noNumber && !enabled && verified && (
        <>
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
            <div className="flex items-center gap-2">
              <PulseIcon name="check" className="w-4 h-4 text-emerald-400" />
              <span>
                Your number{" "}
                <span className="font-bold text-emerald-200">
                  {displayNumber}
                </span>{" "}
                supports voice calling.
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-card p-5 space-y-3">
            <div className="text-base font-extrabold text-white tracking-tight">
              Phone Calling
            </div>
            <p className="text-sm text-zinc-400">
              Make and receive calls from your business number on the mobile
              app and web dashboard. Includes call recording and voicemail.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={enableCalling}
              disabled={busy}
              className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
            >
              {busy ? "Enabling…" : "Enable Phone Calling"}
            </Button>
          </div>
        </>
      )}

      {enabled && (
        <>
          <div className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center">
                  <PulseIcon
                    name="phone"
                    className="w-5 h-5 text-emerald-300"
                  />
                </span>
                <div>
                  <div className="text-base font-extrabold text-white tracking-tight">
                    Phone Calling
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Make and receive calls from your business number
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold rounded-full px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                Active
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
              <PulseIcon name="check" className="w-4 h-4 text-emerald-400" />
              <span>
                Calls are active on{" "}
                <span className="font-bold text-white">{displayNumber}</span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={enableCalling}
                disabled={busy}
                className="h-auto text-xs text-zinc-300 hover:text-white hover:bg-transparent underline font-bold px-0"
                title="Re-create the Twilio API Key + TwiML App and re-point the number's voice webhook. Fixes legacy configurations where the inbound webhook was never set correctly."
              >
                {busy ? "Working…" : "Re-sync calling"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={disableCalling}
                disabled={busy}
                className="h-auto text-xs text-rose-400 hover:text-rose-300 hover:bg-transparent underline font-bold px-0"
              >
                {busy ? "Working…" : "Remove phone calling"}
              </Button>
            </div>
            <TwilioConfigDiagnostic
              expectedInbound={
                typeof window !== "undefined"
                  ? `${window.location.origin}/api/voice/inbound`
                  : "/api/voice/inbound"
              }
            />
          </div>

          <CallerIdCard initialName={status.caller_id_name} />
          <VoicemailGreetingCard
            initialHasGreeting={status.has_voicemail_greeting}
          />
        </>
      )}

      {error && <p className="text-sm text-rose-500">{error}</p>}
      {statusMsg && !error && (
        <p className="text-sm text-emerald-500">{statusMsg}</p>
      )}
    </div>
  );
}

function TwilioConfigDiagnostic({ expectedInbound }: { expectedInbound: string }) {
  type Config = {
    account_sid: string;
    phone_number: string;
    phone_number_sid: string;
    friendly_name: string | null;
    voice_url: string | null;
    voice_method: string | null;
    voice_application_sid: string | null;
    sms_url: string | null;
    capabilities: { voice?: boolean; sms?: boolean; mms?: boolean } | null;
  };
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/voice/twilio-config", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as
        | Config
        | { error?: string };
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ||
            `Could not fetch Twilio config (HTTP ${res.status})`
        );
        setConfig(null);
        return;
      }
      setConfig(data as Config);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !config && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const voiceUrlOk =
    config?.voice_url && config.voice_url.startsWith(expectedInbound);

  return (
    <div className="mt-4 border-t border-line pt-3">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent px-0 font-bold"
      >
        {open ? "Hide" : "Show"} Twilio webhook config
      </Button>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-black/40 p-3 text-xs space-y-2 font-mono">
          {loading && <p className="text-zinc-400">Fetching from Twilio…</p>}
          {error && <p className="text-rose-400 break-all">{error}</p>}
          {config && (
            <>
              <div>
                <span className="text-zinc-500">Number SID:</span>{" "}
                <span className="text-zinc-200 break-all">
                  {config.phone_number_sid}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Account SID:</span>{" "}
                <span className="text-zinc-200 break-all">
                  {config.account_sid}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Voice URL:</span>{" "}
                <span
                  className={
                    "break-all " +
                    (voiceUrlOk ? "text-emerald-300" : "text-amber-300")
                  }
                >
                  {config.voice_url || "(not set)"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Voice Method:</span>{" "}
                <span className="text-zinc-200">
                  {config.voice_method || "(none)"}
                </span>
              </div>
              {config.voice_application_sid && (
                <div>
                  <span className="text-zinc-500">Voice App SID:</span>{" "}
                  <span className="text-zinc-200 break-all">
                    {config.voice_application_sid}
                  </span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">SMS URL:</span>{" "}
                <span className="text-zinc-200 break-all">
                  {config.sms_url || "(not set)"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Capabilities:</span>{" "}
                <span className="text-zinc-200">
                  voice={String(config.capabilities?.voice ?? false)}, sms=
                  {String(config.capabilities?.sms ?? false)}, mms=
                  {String(config.capabilities?.mms ?? false)}
                </span>
              </div>
              <div className="pt-1 border-t border-line">
                <span className="text-zinc-500">Expected Voice URL:</span>{" "}
                <span className="text-zinc-300 break-all">
                  {expectedInbound}
                </span>
                {!voiceUrlOk && (
                  <p className="mt-1 text-amber-300 font-sans not-italic">
                    Voice URL doesn&apos;t match. Click <strong>Re-sync calling</strong>{" "}
                    to repoint it. If that fails, paste this entire block into
                    chat so we can diagnose.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={load}
                disabled={loading}
                className="h-auto text-xs text-zinc-400 hover:text-white hover:bg-transparent underline font-bold px-0 font-sans not-italic"
              >
                {loading ? "Loading…" : "Refresh"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CallerIdCard({ initialName }: { initialName: string | null }) {
  const [name, setName] = useState(initialName ?? "");
  const [savedName, setSavedName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setName(initialName ?? "");
    setSavedName(initialName ?? "");
  }, [initialName]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/voice/caller-id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        name?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || `Could not save (HTTP ${res.status})`);
        return;
      }
      const next = data.name ?? "";
      setName(next);
      setSavedName(next);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const dirty = savedName !== name;

  return (
    <div className="rounded-xl border border-line bg-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-black border border-line flex items-center justify-center">
          <PulseIcon name="user" className="w-5 h-5 text-zinc-300" />
        </span>
        <div>
          <div className="text-base font-extrabold text-white tracking-tight">
            Caller ID
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            The name that appears when you call customers
          </div>
        </div>
      </div>
      <Field label="Business Name">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 15))}
            maxLength={15}
            placeholder="Acme Window C"
            className="h-auto flex-1 border-line rounded-full px-4 py-2 text-sm bg-card"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={save}
            disabled={saving || !dirty}
            className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Field>
      <div className="text-xs text-zinc-500">
        {name.trim().length}/15 characters
      </div>
      <p className="text-xs text-zinc-500">
        Max 15 characters — letters, numbers, and spaces only. May take 24–48
        hours to propagate.
      </p>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {savedAt && !error && !dirty && (
        <p className="text-xs text-emerald-500">Saved</p>
      )}
    </div>
  );
}

function VoicemailGreetingCard({
  initialHasGreeting,
}: {
  initialHasGreeting: boolean;
}) {
  const [hasGreeting, setHasGreeting] = useState(initialHasGreeting);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setHasGreeting(initialHasGreeting);
  }, [initialHasGreeting]);

  async function uploadDataUrl(dataUrl: string) {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/settings/voice/voicemail-greeting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greeting: dataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        has_greeting?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Could not save greeting");
        return;
      }
      setHasGreeting(true);
    } finally {
      setUploading(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please choose an audio file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      void uploadDataUrl(dataUrl);
    };
    reader.onerror = () => setError("Could not read audio file");
    reader.readAsDataURL(file);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          void uploadDataUrl(dataUrl);
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setError(
        (e as Error).message ||
          "Microphone access denied. Allow mic permission and try again."
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function removeGreeting() {
    if (!confirm("Remove voicemail greeting and use the default?")) return;
    setError(null);
    setUploading(true);
    try {
      await fetch("/api/settings/voice/voicemail-greeting", {
        method: "DELETE",
      });
      setHasGreeting(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-black border border-line flex items-center justify-center">
          <PulseIcon name="settings" className="w-5 h-5 text-zinc-300" />
        </span>
        <div>
          <div className="text-base font-extrabold text-white tracking-tight">
            Call Settings
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            Customize your voicemail greeting
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold text-zinc-500 mb-1">
          Voicemail Greeting
        </div>
        <p className="text-xs text-zinc-400 mb-3">
          {hasGreeting
            ? "Custom greeting saved. Upload or record again to replace it."
            : "Using default greeting. Upload an audio file or record one directly."}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Native <input type="file"> kept: no FileInput primitive in design system; matches the existing logo / photo upload pattern. */}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            onChange={onFile}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || recording}
            className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-4 py-2 font-bold"
          >
            Upload File
          </Button>
          {!recording ? (
            <Button
              type="button"
              variant="ghost"
              onClick={startRecording}
              disabled={uploading}
              className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-4 py-2 font-bold gap-1.5"
            >
              <PulseIcon name="mic" className="w-3.5 h-3.5" />
              Record
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={stopRecording}
              className="h-auto text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-full px-4 py-2 font-bold gap-1.5"
            >
              <PulseIcon name="mic-off" className="w-3.5 h-3.5" />
              Stop
            </Button>
          )}
          {hasGreeting && (
            <Button
              type="button"
              variant="ghost"
              onClick={removeGreeting}
              disabled={uploading || recording}
              className="h-auto text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
            >
              Remove
            </Button>
          )}
        </div>
        {(uploading || recording) && (
          <p className="text-xs text-zinc-400 mt-2">
            {recording ? "Recording…" : "Saving…"}
          </p>
        )}
        {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
      </div>
    </div>
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
  effective_from: string | null;
  using_platform: boolean;
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
        <h2 className="text-lg font-extrabold text-white tracking-tight">Email</h2>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Email to your customers — blasts, automations, and receipts — works
          out of the box. By default it sends from Forge&apos;s shared domain,
          with replies routed to your company email. Want mail to come from your
          own domain instead? Connect your Resend account below.
        </p>
      </div>

      <div
        className={
          "flex items-center gap-2 text-xs font-bold rounded-full px-3 py-1 w-fit " +
          (status?.configured
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-black text-zinc-400 border border-line")
        }
      >
        <span
          className={
            "w-1.5 h-1.5 rounded-full " +
            (status?.configured ? "bg-emerald-500" : "bg-slate-400")
          }
        />
        {status?.configured
          ? status?.using_platform
            ? "Active"
            : "Connected"
          : "Not connected"}
        {status?.effective_from && (
          <span className="text-zinc-400 font-normal">
            · {status.effective_from}
          </span>
        )}
      </div>

      {status?.using_platform && (
        <p className="text-xs text-zinc-500">
          Sending on Forge&apos;s shared domain. Replies go to your company
          email. Connect your own Resend below to send from your own domain.
        </p>
      )}

      <div className="rounded-xl border border-line bg-black p-4 space-y-3 text-sm">
        <div className="font-bold text-white tracking-tight">
          Optional — send from your own domain
        </div>
        <p className="text-zinc-400">
          Skip this unless you want mail to come from your own domain instead of
          Forge&apos;s shared one.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-zinc-400">
          <li>
            Sign up at{" "}
            <a
              href="https://resend.com"
              target="_blank"
              rel="noreferrer"
              className="text-white underline"
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
        <Input
          type="password"
          value={apiKey}
          disabled={loading}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card font-mono"
          placeholder={
            status?.api_key_set
              ? `${status.api_key_prefix || "re_"}…  (saved)`
              : "re_xxxxxxxxxxxxxxxxxxxxxxxx"
          }
        />
      </Field>
      <Field label="From address">
        <Input
          type="email"
          value={fromAddress}
          disabled={loading}
          onChange={(e) => setFromAddress(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="hello@yourcompany.com"
        />
      </Field>
      <Field label="From name">
        <Input
          type="text"
          value={fromName}
          disabled={loading}
          onChange={(e) => setFromName(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="Acme Window Cleaning"
        />
      </Field>
      <Field label="Reply-to (optional)">
        <Input
          type="email"
          value={replyTo}
          disabled={loading}
          onChange={(e) => setReplyTo(e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="support@yourcompany.com"
        />
      </Field>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          type="submit"
          disabled={saving || loading}
          className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {savedAt && !saving && (
          <span className="text-xs text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  );
}

type AiStatus = {
  provider: string;
  model: string;
  company_voice: string | null;
  configured: boolean;
  managed: true;
  usage: {
    period: string;
    used: number;
    limit: number;
    remaining: number;
  };
};

const AI_MODEL_ID = "claude-sonnet-4-6";
const AI_MODEL_LABEL = "Claude Sonnet 4.6";

function AiPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [voice, setVoice] = useState("");

  async function load() {
    const res = await fetch("/api/settings/ai", { cache: "no-store" });
    if (res.ok) {
      const s = (await res.json()) as AiStatus;
      setStatus(s);
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
        model: AI_MODEL_ID,
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
    setSavedAt(Date.now());
  }

  const usage = status?.usage;
  const usagePct =
    usage && usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0;
  const usageBarColor =
    usagePct >= 100
      ? "bg-rose-500"
      : usagePct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-white tracking-tight">AI</h2>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Claude drafts replies in the Messages tab. The AI reads the recent
          conversation and writes a suggested reply you can edit before sending.
          Claude is included with your account — no API key required.
        </p>
      </div>

      <div
        className={
          "flex items-center gap-2 text-xs font-bold rounded-full px-3 py-1 w-fit " +
          (status?.configured
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-black text-zinc-400 border border-line")
        }
      >
        <span
          className={
            "w-1.5 h-1.5 rounded-full " +
            (status?.configured ? "bg-emerald-500" : "bg-slate-400")
          }
        />
        {status?.configured ? "Active" : "Unavailable"}
        {status?.configured && status?.model && (
          <span className="text-zinc-400 font-normal">· {status.model}</span>
        )}
      </div>

      {usage && (
        <div className="rounded-xl border border-line bg-black p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-bold text-white tracking-tight">
              Drafts this month
            </div>
            <div className="text-sm text-zinc-400 font-bold">
              <span className="text-white tabular-nums">{usage.used}</span>
              <span className="text-zinc-500"> / {usage.limit}</span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-line overflow-hidden">
            <div
              className={`h-full ${usageBarColor} transition-all`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 font-bold">
            Resets on the 1st of every month. {usage.remaining} drafts left.
          </p>
        </div>
      )}

      <Field label="Model">
        <div className="w-full border border-line rounded-full px-4 py-2 text-sm bg-card text-zinc-300 font-bold">
          {AI_MODEL_LABEL}
        </div>
      </Field>
      <Field label="Company voice (optional)">
        <Textarea
          value={voice}
          disabled={loading}
          onChange={(e) => setVoice(e.target.value)}
          rows={4}
          className="w-full border-line rounded-2xl px-4 py-2 text-sm bg-card"
          placeholder={
            "e.g. Friendly and concise. Never defensive. If a customer complains, always offer a free re-clean and a callback within 24 hours."
          }
        />
        <p className="text-xs font-bold text-zinc-500 mt-2">
          Used as part of the prompt for every drafted reply. Describe tone,
          policies, and how you want to handle complaints.
        </p>
      </Field>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          type="submit"
          disabled={saving || loading}
          className="h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-5 py-2 font-bold"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
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
      <div className="mx-auto w-12 h-12 rounded-full bg-black flex items-center justify-center text-zinc-500">
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
      <h2 className="text-lg font-extrabold text-white tracking-tight">Billing</h2>
      <p className="text-sm text-zinc-400 font-bold">Coming soon.</p>
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
      <Label className="block text-xs font-bold text-zinc-500 mb-1.5 font-normal">
        {label}
      </Label>
      {children}
    </div>
  );
}
