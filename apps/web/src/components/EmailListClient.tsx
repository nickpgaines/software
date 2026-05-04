"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Blast = {
  id: number;
  audience: string;
  subject: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
};

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
  last_sent_year: number | null;
};

const AUDIENCE_LABELS: Record<string, string> = {
  all_customers: "All customers",
  active_subscribers: "Active subscribers",
  non_subscribers: "Non-subscribers",
  prospects: "Prospects",
};

const SEASON_EMOJI: Record<string, string> = {
  spring: "🌱",
  summer: "☀️",
  fall: "🍂",
  winter: "❄️",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtSendWindow(a: Automation): string {
  if (a.kind === "welcome") return "On customer signup";
  if (a.send_month && a.send_day) {
    return `${MONTHS[a.send_month - 1]} ${a.send_day}`;
  }
  return "—";
}

function statusBadge(status: string) {
  if (status === "sent")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "partial")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "failed")
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "sending")
    return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-black text-zinc-300 border-[#1f1f24]";
}

export default function EmailListClient() {
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/email/blasts", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/email/automations", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([b, a]) => {
        setBlasts(b as Blast[]);
        setAutomations(a as Automation[]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleAutomation(a: Automation, enabled: boolean) {
    setError(null);
    setBusyId(a.id);
    const prev = automations;
    setAutomations((list) =>
      list.map((x) => (x.id === a.id ? { ...x, enabled: enabled ? 1 : 0 } : x))
    );
    const res = await fetch(`/api/email/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setBusyId(null);
    if (!res.ok) {
      setAutomations(prev);
      setError("Could not update automation.");
    }
  }

  async function runAutomation(a: Automation) {
    setError(null);
    setFlash(null);
    if (!window.confirm(`Send "${a.name}" to ${AUDIENCE_LABELS[a.audience] || a.audience} now?`)) {
      return;
    }
    setBusyId(a.id);
    const res = await fetch(`/api/email/automations/${a.id}/run`, {
      method: "POST",
    });
    setBusyId(null);
    const data = (await res.json().catch(() => ({}))) as {
      sent?: number;
      attempted?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not send.");
      return;
    }
    setFlash(
      `Sent ${data.sent ?? 0} of ${data.attempted ?? 0}. Check the blast history below.`
    );
    fetch("/api/email/blasts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((b: Blast[]) => setBlasts(b));
    fetch("/api/email/automations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Automation[]) => setAutomations(list));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Email</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Send one-off blasts or turn on automated emails that go out on their own.
          </p>
        </div>
        <Link
          href="/email/new"
          className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-2 font-medium"
        >
          New blast
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {flash && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {flash}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Automated emails
          </h2>
          <span className="text-xs text-zinc-500">
            Toggle on to enable. Edit to customize the message.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-[#0f0f12] border border-[#1f1f24] rounded-2xl animate-pulse"
                />
              ))
            : automations.map((a) => (
                <div
                  key={a.id}
                  className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">
                          {a.kind === "welcome"
                            ? "👋"
                            : a.season
                              ? SEASON_EMOJI[a.season]
                              : "📧"}
                        </span>
                        <h3 className="font-medium text-white">{a.name}</h3>
                      </div>
                      {a.description && (
                        <p className="text-xs text-zinc-400 mt-1">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.enabled === 1}
                      disabled={busyId === a.id}
                      onClick={() => toggleAutomation(a, a.enabled !== 1)}
                      className={
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition disabled:opacity-50 " +
                        (a.enabled === 1 ? "bg-emerald-500" : "bg-[#1f1f24]")
                      }
                    >
                      <span
                        className={
                          "inline-block h-5 w-5 transform rounded-full bg-[#0f0f12] shadow transition " +
                          (a.enabled === 1 ? "translate-x-5" : "translate-x-0.5")
                        }
                      />
                    </button>
                  </div>

                  <div className="text-xs text-zinc-400 grid grid-cols-2 gap-y-1 gap-x-4">
                    <div>
                      <span className="text-zinc-500">Audience: </span>
                      <span className="text-zinc-300">
                        {AUDIENCE_LABELS[a.audience] || a.audience}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">When: </span>
                      <span className="text-zinc-300">{fmtSendWindow(a)}</span>
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-zinc-500">Subject: </span>
                      <span className="text-zinc-300">
                        {a.subject || (
                          <span className="italic text-zinc-500">
                            (none yet)
                          </span>
                        )}
                      </span>
                    </div>
                    {a.last_sent_at && (
                      <div className="col-span-2" suppressHydrationWarning>
                        <span className="text-zinc-500">Last sent: </span>
                        <span className="text-zinc-300">
                          {mounted ? fmtTime(a.last_sent_at) : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/email/automations/${a.id}`}
                      className="text-xs bg-[#0f0f12] border border-[#1f1f24] hover:bg-black rounded-full px-3 py-1.5 font-medium"
                    >
                      Edit
                    </Link>
                    {a.kind === "seasonal" && (
                      <button
                        type="button"
                        onClick={() => runAutomation(a)}
                        disabled={busyId === a.id || a.enabled !== 1}
                        className="text-xs bg-[#0f0f12] border border-[#1f1f24] hover:bg-black disabled:opacity-50 rounded-full px-3 py-1.5 font-medium"
                        title={
                          a.enabled !== 1
                            ? "Enable this automation to send"
                            : "Send to the configured audience now"
                        }
                      >
                        Send now
                      </button>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Blast history
        </h2>
        <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-zinc-500">Loading…</div>
          ) : blasts.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              No blasts yet. Click <strong>New blast</strong> to send your first.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-black text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Sent</th>
                  <th className="text-left px-4 py-2 font-medium">Subject</th>
                  <th className="text-left px-4 py-2 font-medium">Audience</th>
                  <th className="text-left px-4 py-2 font-medium">Recipients</th>
                  <th className="text-left px-4 py-2 font-medium">Delivered</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f24]">
                {blasts.map((b) => (
                  <tr key={b.id} className="hover:bg-black">
                    <td
                      className="px-4 py-2 text-zinc-300 whitespace-nowrap"
                      suppressHydrationWarning
                    >
                      {mounted ? fmtTime(b.sent_at || b.created_at) : ""}
                    </td>
                    <td className="px-4 py-2 font-medium text-white">
                      <Link href={`/email/${b.id}`} className="hover:underline">
                        {b.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-300">
                      {AUDIENCE_LABELS[b.audience] || b.audience}
                    </td>
                    <td className="px-4 py-2 text-zinc-300 tabular-nums">
                      {b.recipient_count}
                    </td>
                    <td className="px-4 py-2 text-zinc-300 tabular-nums">
                      {b.sent_count}
                      {b.failed_count > 0 && (
                        <span className="text-rose-600">
                          {" "}· {b.failed_count} failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          "text-[11px] rounded-full px-2 py-0.5 border capitalize " +
                          statusBadge(b.status)
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
