"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export default function EmailComposeClient() {
  const router = useRouter();
  const [audiences, setAudiences] = useState<AudienceCount[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [audience, setAudience] = useState<AudienceCount["audience"] | "">("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email/audiences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { audiences: [] }))
      .then((data: { audiences: AudienceCount[] }) => setAudiences(data.audiences || []));
    fetch("/api/settings/email", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: EmailStatus | null) => setEmailStatus(s));
  }, []);

  const selectedCount = useMemo(
    () => audiences.find((a) => a.audience === audience)?.count ?? 0,
    [audience, audiences]
  );

  async function handleTestSend() {
    setError(null);
    setInfo(null);
    if (!subject.trim() || !bodyHtml.trim()) {
      setError("Subject and message are required.");
      return;
    }
    if (!testEmail.trim()) {
      setError("Enter your email address to send a test.");
      return;
    }
    setSending(true);
    const res = await fetch("/api/email/blasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: "all_customers", // ignored when test_email is set
        subject,
        body_html: bodyHtml,
        test_email: testEmail.trim(),
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not send test");
      return;
    }
    setInfo(`Test sent to ${testEmail.trim()}.`);
  }

  async function handleSend() {
    setError(null);
    setInfo(null);
    if (!audience) {
      setError("Pick an audience.");
      return;
    }
    if (!subject.trim() || !bodyHtml.trim()) {
      setError("Subject and message are required.");
      return;
    }
    if (selectedCount === 0) {
      setError("That audience has no recipients with email addresses.");
      return;
    }
    const ok = window.confirm(
      `Send "${subject.trim()}" to ${selectedCount} recipient${
        selectedCount === 1 ? "" : "s"
      }?`
    );
    if (!ok) return;
    setSending(true);
    const res = await fetch("/api/email/blasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience,
        subject,
        body_html: bodyHtml,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not send");
      return;
    }
    const blast = (await res.json()) as { id: number };
    router.push(`/email/${blast.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/email"
          className="text-xs text-zinc-400 hover:text-white"
        >
          ← All blasts
        </Link>
        <h1 className="text-page-title text-white mt-2">
          New email blast
        </h1>
      </div>

      {!emailStatus?.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Email isn&apos;t connected yet. Go to{" "}
          <Link
            href="/settings?tab=email"
            className="underline font-bold"
          >
            Settings → Email
          </Link>{" "}
          to add your Resend API key and verified sending address before you
          can send.
        </div>
      )}

      <div className="bg-card border border-line rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <Label className="block text-eyebrow-tight uppercase text-zinc-500 mb-2">
            Audience
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {audiences.map((a) => (
              <Button
                type="button"
                variant="ghost"
                key={a.audience}
                onClick={() => setAudience(a.audience)}
                className={
                  "h-auto text-left p-3 rounded-xl border transition flex-col items-stretch justify-start whitespace-normal hover:bg-transparent " +
                  (audience === a.audience
                    ? "border-slate-900 bg-black"
                    : "border-line hover:border-slate-400")
                }
              >
                <div className="flex items-baseline justify-between w-full">
                  <span className="font-bold text-white tracking-tight">{a.label}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {a.count}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-bold">
                  {AUDIENCE_DESCRIPTIONS[a.audience] || ""}
                </p>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="block text-eyebrow-tight uppercase text-zinc-500 mb-1.5">
            Subject
          </Label>
          <Input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Spring window cleaning special — 15% off this month"
            className="w-full h-auto border-line rounded-full px-4 py-2 text-sm bg-card"
          />
        </div>

        <div>
          <Label className="block text-eyebrow-tight uppercase text-zinc-500 mb-1.5">
            Message (HTML or plain text)
          </Label>
          <Textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={12}
            placeholder={"Hi there,\n\nWe're running a 15% off special on..."}
            className="w-full border-line rounded-2xl px-4 py-3 text-sm bg-card font-mono"
          />
          <p className="text-xs text-zinc-500 mt-2">
            An unsubscribe link and your business address are appended to every
            email automatically.
          </p>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {info && <p className="text-sm text-emerald-700">{info}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-auto border-line rounded-full px-4 py-2 text-sm bg-card w-64"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={handleTestSend}
            disabled={sending || !emailStatus?.configured}
            className="h-auto text-sm bg-card border border-line hover:bg-black rounded-full px-4 py-2 font-bold"
          >
            Send test
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            onClick={handleSend}
            disabled={sending || !emailStatus?.configured}
            className="h-auto text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
          >
            {sending
              ? "Sending…"
              : `Send to ${selectedCount} recipient${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
