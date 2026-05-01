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

const AUDIENCE_LABELS: Record<string, string> = {
  all_customers: "All customers",
  active_subscribers: "Active subscribers",
  non_subscribers: "Non-subscribers",
  prospects: "Prospects",
};

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

function statusBadge(status: string) {
  if (status === "sent")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "partial")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "failed")
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "sending")
    return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function EmailListClient() {
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/email/blasts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Blast[]) => setBlasts(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Email</h1>
          <p className="text-sm text-slate-500 mt-1">
            Send email blasts to your customers, subscribers, and prospects.
          </p>
        </div>
        <Link
          href="/email/new"
          className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-2 font-medium"
        >
          New blast
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : blasts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No blasts yet. Click <strong>New blast</strong> to send your first.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Sent</th>
                <th className="text-left px-4 py-2 font-medium">Subject</th>
                <th className="text-left px-4 py-2 font-medium">Audience</th>
                <th className="text-left px-4 py-2 font-medium">Recipients</th>
                <th className="text-left px-4 py-2 font-medium">Delivered</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {blasts.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700 whitespace-nowrap" suppressHydrationWarning>
                    {mounted ? fmtTime(b.sent_at || b.created_at) : ""}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/email/${b.id}`} className="hover:underline">
                      {b.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {AUDIENCE_LABELS[b.audience] || b.audience}
                  </td>
                  <td className="px-4 py-2 text-slate-700 tabular-nums">
                    {b.recipient_count}
                  </td>
                  <td className="px-4 py-2 text-slate-700 tabular-nums">
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
    </div>
  );
}
