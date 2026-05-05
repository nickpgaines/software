"use client";

import { useEffect, useState } from "react";
import { usePhone } from "@/components/PhoneClient";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          <h1 className="text-page-title text-white">Calls</h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            All calls made and received through your business number.
          </p>
        </div>
        {!phone.configured && (
          <Badge
            variant="outline"
            className="text-xs text-zinc-400 bg-black border border-[#1f1f24] rounded-full px-3 py-1 font-normal"
          >
            Calling not configured. Connect Twilio Voice in Settings → Calling.
          </Badge>
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
          <Table>
            <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-[#1f1f24]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">When</TableHead>
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Direction</TableHead>
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Customer</TableHead>
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Number</TableHead>
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Status</TableHead>
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Duration</TableHead>
                <TableHead className="h-auto px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">Recording</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#1f1f24]">
              {calls.map((c) => {
                const otherNumber =
                  c.direction === "outbound" ? c.to_phone : c.from_phone;
                return (
                  <TableRow key={c.id} className="border-0 hover:bg-transparent">
                    <TableCell className="px-4 py-2 text-zinc-300 whitespace-nowrap" suppressHydrationWarning>
                      {mounted ? fmtTime(c.created_at) : ""}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-zinc-300 capitalize">
                      {c.direction}
                    </TableCell>
                    <TableCell className="px-4 py-2 font-bold text-white tracking-tight">
                      {c.customer_name || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-zinc-300 font-bold">
                      {otherNumber || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={
                          "text-[11px] rounded-full px-2 py-0.5 border font-normal " +
                          statusColor(c.status)
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-zinc-300 tabular-nums">
                      {fmtDuration(c.duration_seconds)}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {c.recording_sid ? (
                        <audio
                          src={`/api/calls/${c.id}/recording`}
                          controls
                          preload="none"
                          className="h-8"
                        />
                      ) : (
                        <span className="text-eyebrow uppercase text-zinc-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
