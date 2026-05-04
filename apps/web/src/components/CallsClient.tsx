"use client";

import { useEffect, useState } from "react";
import { usePhone } from "@/components/PhoneClient";

type CallRow = {
  id: number;
  customer_id: number | null;
  twilio_call_sid: string | null;
  direction: "outbound" | "inbound";
  status: string;
  from_phone: string | null;
  to_phone: string | null;
  duration_seconds: number | null;
  recording_sid: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
};

function fmtDuration(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

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

function statusColor(status: string): string {
  if (status === "completed") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "in-progress" || status === "answered" || status === "ringing")
    return "text-sky-700 bg-sky-50 border-sky-200";
  if (
    status === "failed" ||
    status === "busy" ||
    status === "no-answer" ||
    status === "canceled"
  )
    return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-zinc-300 bg-black border-[#1f1f24]";
}

export default function CallsClient() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const phone = usePhone();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/calls", { cache: "no-store" });
    if (res.ok) setCalls((await res.json()) as CallRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Refresh while a call is active or just ended so the new row appears.
  useEffect(() => {
    if (phone.state.kind === "idle") {
      load();
      return;
    }
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [phone.state.kind]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Calls</h1>
          <p className="text-sm text-zinc-400 mt-1">
            All calls made and received through your business number.
          </p>
        </div>
        {!phone.configured && (
          <span className="text-xs text-zinc-400 bg-black border border-[#1f1f24] rounded-full px-3 py-1">
            Calling not configured. Connect Twilio Voice in Settings → Calling.
          </span>
        )}
      </div>

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading…</div>
        ) : calls.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            No calls yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black text-zinc-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Direction</th>
                <th className="text-left px-4 py-2 font-medium">Customer</th>
                <th className="text-left px-4 py-2 font-medium">Number</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Duration</th>
                <th className="text-left px-4 py-2 font-medium">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f24]">
              {calls.map((c) => {
                const otherNumber =
                  c.direction === "outbound" ? c.to_phone : c.from_phone;
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-zinc-300 whitespace-nowrap" suppressHydrationWarning>
                      {mounted ? fmtTime(c.created_at) : ""}
                    </td>
                    <td className="px-4 py-2 text-zinc-300 capitalize">
                      {c.direction}
                    </td>
                    <td className="px-4 py-2 font-medium text-white">
                      {c.customer_name || "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">
                      {otherNumber || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          "text-[11px] rounded-full px-2 py-0.5 border " +
                          statusColor(c.status)
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-300 tabular-nums">
                      {fmtDuration(c.duration_seconds)}
                    </td>
                    <td className="px-4 py-2">
                      {c.recording_sid ? (
                        <audio
                          src={`/api/calls/${c.id}/recording`}
                          controls
                          preload="none"
                          className="h-8"
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
