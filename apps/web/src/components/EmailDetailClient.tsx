"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Blast = {
  id: number;
  audience: string;
  subject: string;
  body_html: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  from_address: string | null;
  from_name: string | null;
  sent_at: string | null;
  created_at: string;
};

type Recipient = {
  id: number;
  email: string;
  name: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
};

const AUDIENCE_LABELS: Record<string, string> = {
  all_customers: "All customers",
  active_subscribers: "Active subscribers",
  non_subscribers: "Non-subscribers",
  prospects: "Prospects",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EmailDetailClient({ id }: { id: number }) {
  const [data, setData] = useState<{ blast: Blast; recipients: Recipient[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/email/blasts/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading…</div>;
  }
  if (!data) {
    return (
      <div className="space-y-3">
        <Link href="/email" className="text-xs text-zinc-400 hover:text-white">
          ← All blasts
        </Link>
        <p className="text-sm text-zinc-500">Blast not found.</p>
      </div>
    );
  }

  const { blast, recipients } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/email" className="text-xs text-zinc-400 hover:text-white">
          ← All blasts
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-2">
          {blast.subject}
        </h1>
        <p className="text-sm text-zinc-400 mt-1" suppressHydrationWarning>
          {AUDIENCE_LABELS[blast.audience] || blast.audience} ·{" "}
          {mounted ? fmtTime(blast.sent_at || blast.created_at) : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Recipients" value={blast.recipient_count} />
        <Stat label="Delivered" value={blast.sent_count} />
        <Stat label="Failed" value={blast.failed_count} tone={blast.failed_count > 0 ? "rose" : "default"} />
        <Stat label="Status" value={blast.status} />
      </div>

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm p-6">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
          Message preview
        </div>
        <div
          className="prose prose-sm max-w-none text-white border-t border-[#1f1f24] pt-4"
          dangerouslySetInnerHTML={{ __html: blast.body_html }}
        />
      </div>

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1f1f24] text-sm font-medium text-white">
          Recipients
        </div>
        <table className="w-full text-sm">
          <thead className="bg-black text-zinc-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Sent</th>
              <th className="text-left px-4 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f24]">
            {recipients.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-zinc-300">{r.email}</td>
                <td className="px-4 py-2 text-zinc-300">{r.name || "—"}</td>
                <td className="px-4 py-2 text-zinc-300 capitalize">{r.status}</td>
                <td className="px-4 py-2 text-zinc-400" suppressHydrationWarning>
                  {mounted ? fmtTime(r.sent_at) : ""}
                </td>
                <td className="px-4 py-2 text-rose-600">{r.error || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "rose";
}) {
  const ring =
    tone === "rose"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-[#0f0f12] border-[#1f1f24] text-white";
  return (
    <div className={`border rounded-xl p-4 ${ring}`}>
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <div className="text-xl font-semibold capitalize">{value}</div>
    </div>
  );
}
