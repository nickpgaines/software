"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Automation = {
  id: number;
  key: string;
  kind: "welcome" | "seasonal";
  season: "spring" | "summer" | "fall" | "winter" | null;
  name: string;
  description: string | null;
  audience: string;
  subject: string;
  body_html: string;
  send_month: number | null;
  send_day: number | null;
  enabled: number;
  last_sent_at: string | null;
};

type AudienceCount = {
  audience: "all_customers" | "active_subscribers" | "non_subscribers" | "prospects";
  label: string;
  count: number;
};

type EmailStatus = {
  configured: boolean;
  from_address: string | null;
  from_name: string | null;
};

const AUDIENCE_DESCRIPTIONS: Record<string, string> = {
  all_customers: "Every customer with an email on file.",
  active_subscribers: "Customers with an active recurring subscription.",
  non_subscribers: "Customers without an active subscription.",
  prospects: "Customers who have an estimate but no completed job.",
};

const MONTHS = [
  { v: 1, label: "January" },
  { v: 2, label: "February" },
  { v: 3, label: "March" },
  { v: 4, label: "April" },
  { v: 5, label: "May" },
  { v: 6, label: "June" },
  { v: 7, label: "July" },
  { v: 8, label: "August" },
  { v: 9, label: "September" },
  { v: 10, label: "October" },
  { v: 11, label: "November" },
  { v: 12, label: "December" },
];

export default function EmailAutomationEditClient({ id }: { id: string }) {
  const router = useRouter();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [audiences, setAudiences] = useState<AudienceCount[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/email/automations/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a: Automation | null) => setAutomation(a))
      .finally(() => setLoading(false));
    fetch("/api/email/audiences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { audiences: [] }))
      .then((data: { audiences: AudienceCount[] }) =>
        setAudiences(data.audiences || [])
      );
    fetch("/api/settings/email", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: EmailStatus | null) => setEmailStatus(s));
  }, [id]);

  const selectedCount = useMemo(
    () =>
      audiences.find((a) => a.audience === automation?.audience)?.count ?? 0,
    [automation?.audience, audiences]
  );

  function patch<K extends keyof Automation>(key: K, value: Automation[K]) {
    setAutomation((a) => (a ? { ...a, [key]: value } : a));
  }

  async function handleSave() {
    if (!automation) return;
    setError(null);
    setInfo(null);
    if (!automation.subject.trim() || !automation.body_html.trim()) {
      setError("Subject and message are required.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/email/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: automation.audience,
        subject: automation.subject,
        body_html: automation.body_html,
        send_month: automation.send_month,
        send_day: automation.send_day,
        enabled: automation.enabled === 1,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not save.");
      return;
    }
    const updated = (await res.json()) as Automation;
    setAutomation(updated);
    setInfo("Saved.");
  }

  async function handleTestSend() {
    if (!automation) return;
    setError(null);
    setInfo(null);
    if (!testEmail.trim()) {
      setError("Enter your email address to send a test.");
      return;
    }
    if (!automation.subject.trim() || !automation.body_html.trim()) {
      setError("Subject and message are required.");
      return;
    }
    setTesting(true);
    const res = await fetch("/api/email/blasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: "all_customers",
        subject: automation.subject,
        body_html: automation.body_html,
        test_email: testEmail.trim(),
      }),
    });
    setTesting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not send test.");
      return;
    }
    setInfo(`Test sent to ${testEmail.trim()}.`);
  }

  async function handleSendNow() {
    if (!automation || automation.kind !== "seasonal") return;
    if (
      !window.confirm(
        `Send "${automation.subject}" to ${selectedCount} recipient${
          selectedCount === 1 ? "" : "s"
        } now?`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/email/automations/${automation.id}/run`, {
      method: "POST",
    });
    setSaving(false);
    const data = (await res.json().catch(() => ({}))) as {
      sent?: number;
      attempted?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not send.");
      return;
    }
    setInfo(`Sent ${data.sent ?? 0} of ${data.attempted ?? 0}.`);
    router.refresh();
  }

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading…</div>;
  }
  if (!automation) {
    return (
      <div className="text-sm text-zinc-400 font-bold">
        Automation not found.{" "}
        <Link href="/email" className="underline">
          Back to email
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/email" className="text-xs text-zinc-400 hover:text-white">
          ← All email
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-[40px] font-extrabold tracking-tight leading-none text-white">
            {automation.name}
          </h1>
          <label className="flex items-center gap-2 text-sm text-zinc-300 font-bold">
            <span>{automation.enabled === 1 ? "Enabled" : "Disabled"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={automation.enabled === 1}
              onClick={() =>
                patch("enabled", automation.enabled === 1 ? 0 : 1)
              }
              className={
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition " +
                (automation.enabled === 1 ? "bg-emerald-500" : "bg-[#1f1f24]")
              }
            >
              <span
                className={
                  "inline-block h-5 w-5 transform rounded-full bg-[#0f0f12] shadow transition " +
                  (automation.enabled === 1
                    ? "translate-x-5"
                    : "translate-x-0.5")
                }
              />
            </button>
          </label>
        </div>
        {automation.description && (
          <p className="text-sm text-zinc-400 mt-3 font-bold">{automation.description}</p>
        )}
      </div>

      {!emailStatus?.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Email isn&apos;t connected yet. Go to{" "}
          <Link href="/settings?tab=email" className="underline font-bold">
            Settings → Email
          </Link>{" "}
          to add your Resend API key and verified sending address before this
          automation can send.
        </div>
      )}

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-2">
            Audience
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {audiences.map((a) => (
              <button
                type="button"
                key={a.audience}
                onClick={() => patch("audience", a.audience)}
                className={
                  "text-left p-3 rounded-xl border transition " +
                  (automation.audience === a.audience
                    ? "border-slate-900 bg-black"
                    : "border-[#1f1f24] hover:border-slate-400")
                }
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-white tracking-tight">{a.label}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {a.count}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {AUDIENCE_DESCRIPTIONS[a.audience] || ""}
                </p>
              </button>
            ))}
          </div>
        </div>

        {automation.kind === "seasonal" && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-2">
              Send date
            </label>
            <div className="flex items-center gap-2">
              <select
                value={automation.send_month ?? ""}
                onChange={(e) =>
                  patch(
                    "send_month",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="border border-[#1f1f24] rounded-full px-3 py-2 text-sm bg-[#0f0f12]"
              >
                <option value="">Month…</option>
                {MONTHS.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                value={automation.send_day ?? ""}
                onChange={(e) =>
                  patch(
                    "send_day",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="Day"
                className="border border-[#1f1f24] rounded-full px-3 py-2 text-sm bg-[#0f0f12] w-24"
              />
              <span className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
                Sends once per year on this date when enabled.
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={automation.subject}
            onChange={(e) => patch("subject", e.target.value)}
            placeholder="Spring is here — book your seasonal service"
            className="w-full border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12]"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
            Message (HTML or plain text)
          </label>
          <textarea
            value={automation.body_html}
            onChange={(e) => patch("body_html", e.target.value)}
            rows={12}
            placeholder="Hi there, ..."
            className="w-full border border-[#1f1f24] rounded-2xl px-4 py-3 text-sm bg-[#0f0f12] font-mono"
          />
          <p className="text-xs text-zinc-500 mt-2">
            An unsubscribe link and your business address are appended
            automatically.
          </p>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {info && <p className="text-sm text-emerald-700">{info}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1f1f24]">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="border border-[#1f1f24] rounded-full px-4 py-2 text-sm bg-[#0f0f12] w-64"
          />
          <button
            type="button"
            onClick={handleTestSend}
            disabled={testing || !emailStatus?.configured}
            className="text-sm bg-[#0f0f12] border border-[#1f1f24] hover:bg-black disabled:opacity-50 rounded-full px-4 py-2 font-bold"
          >
            Send test
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {automation.kind === "seasonal" && (
            <button
              type="button"
              onClick={handleSendNow}
              disabled={
                saving || automation.enabled !== 1 || !emailStatus?.configured
              }
              className="text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#2a2a32] text-white rounded-full px-5 py-2 font-bold"
              title={
                automation.enabled !== 1
                  ? "Enable to send"
                  : `Send to ${selectedCount} recipient${
                      selectedCount === 1 ? "" : "s"
                    } now`
              }
            >
              Send now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
