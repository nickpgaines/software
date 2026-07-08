"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type View = "sales" | "tech";
export type Range = "today" | "week" | "month" | "year" | "custom";

export type Row = {
  id: number;
  name: string;
  role: string | null;
  permission_level?: string | null;
  photo_url: string | null;
  color: string | null;
  revenue_cents: number;
  job_count: number;
  last_sale_at: string | null;
};

export const PRESET_RANGES: { key: Exclude<Range, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

export function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(iso: string | null, mounted: boolean) {
  if (!iso) return "—";
  if (!mounted) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function rankBadgeClass(i: number) {
  if (i === 0) return "bg-amber-400 text-white";
  if (i === 1) return "bg-line-strong text-white";
  if (i === 2) return "bg-orange-300 text-white";
  return "bg-black text-zinc-400";
}

export function roleBadgeClass(role: string | null) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "bg-rose-100 text-rose-600";
  if (r === "sales" || r === "salesperson") return "bg-sky-100 text-sky-700";
  if (r === "tech" || r === "technician") return "bg-emerald-100 text-emerald-700";
  return "bg-black text-zinc-400";
}

export function avatarColor(name: string) {
  const colors = [
    "bg-amber-100 text-amber-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-rose-100 text-rose-700",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-line rounded-2xl px-4 py-3.5 md:px-5 md:py-4">
      <div className="text-[13px] md:text-[14px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 md:mt-2.5 text-[22px] md:text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white truncate">
        {value}
      </div>
    </div>
  );
}

export type LeaderboardRankingsViewProps = {
  view: View;
  range: Range;
  rows: Row[];
  total: number;
  totalJobs: number;
  topName: string | null;
  meId?: number | null;
  customFrom?: string;
  customTo?: string;
  mounted?: boolean;
  loading?: boolean;
  canSeeSales?: boolean;
  canSeeTech?: boolean;
  onViewChange?: (v: View) => void;
  onRangeChange?: (r: Exclude<Range, "custom">) => void;
  onCustomToggle?: () => void;
  customOpen?: boolean;
  onCustomFromChange?: (s: string) => void;
  onCustomToChange?: (s: string) => void;
  onApplyCustom?: () => void;
  onRowClick?: (id: number) => void;
};

export function LeaderboardRankingsView({
  view,
  range,
  rows,
  total,
  totalJobs,
  topName,
  meId = null,
  customFrom = "",
  customTo = "",
  mounted = true,
  loading = false,
  canSeeSales = true,
  canSeeTech = true,
  onViewChange,
  onRangeChange,
  onCustomToggle,
  customOpen = false,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
  onRowClick,
}: LeaderboardRankingsViewProps) {
  const personColumn = view === "sales" ? "SALESPERSON" : "TECHNICIAN";
  const avgColumn = view === "sales" ? "AVG DEAL" : "AVG JOB";
  const lastColumn = view === "sales" ? "LAST SALE" : "LAST JOB";

  const customRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!customRef.current?.contains(e.target as Node)) {
        if (onCustomToggle && customOpen) onCustomToggle();
      }
    }
    if (customOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [customOpen, onCustomToggle]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end gap-4 flex-wrap">
        <div className="overflow-x-auto scrollbar-none max-w-full">
        <div className="inline-flex items-center gap-1 bg-black rounded-full p-1 text-sm">
          {canSeeSales && (
            <Button
              variant="ghost"
              onClick={onViewChange ? () => onViewChange("sales") : undefined}
              className={
                "h-auto whitespace-nowrap px-4 py-1.5 rounded-full font-bold hover:bg-transparent " +
                (view === "sales"
                  ? "bg-card text-white shadow-sm"
                  : "text-zinc-400 hover:text-white")
              }
            >
              Sales
            </Button>
          )}
          {canSeeTech && (
            <Button
              variant="ghost"
              onClick={onViewChange ? () => onViewChange("tech") : undefined}
              className={
                "h-auto whitespace-nowrap px-4 py-1.5 rounded-full font-bold hover:bg-transparent " +
                (view === "tech"
                  ? "bg-card text-white shadow-sm"
                  : "text-zinc-400 hover:text-white")
              }
            >
              Technicians
            </Button>
          )}
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Revenue" value={money(total)} />
        <KpiCard label="Total Jobs" value={String(totalJobs)} />
        <KpiCard label="Top Performer" value={topName || "—"} />
      </div>

      <div id="rankings" className="bg-card border border-line rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="font-extrabold text-white tracking-tight">
              {view === "sales" ? "Sales Rankings" : "Technician Rankings"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 max-w-full">
            <div className="flex flex-wrap items-center gap-1 bg-black border border-line rounded-2xl p-1 text-sm max-w-full">
              {PRESET_RANGES.map((r) => (
                <Button
                  key={r.key}
                  variant="ghost"
                  onClick={onRangeChange ? () => onRangeChange(r.key) : undefined}
                  className={
                    "h-auto px-3 py-1 rounded-full whitespace-nowrap font-bold hover:bg-transparent " +
                    (range === r.key
                      ? "bg-card text-white shadow-sm"
                      : "text-zinc-400 hover:text-white")
                  }
                >
                  {r.label}
                </Button>
              ))}
              <div ref={customRef} className="relative">
                <Button
                  variant="ghost"
                  onClick={onCustomToggle ? () => onCustomToggle() : undefined}
                  className={
                    "h-auto px-3 py-1 rounded-full whitespace-nowrap gap-1 font-bold hover:bg-transparent " +
                    (range === "custom"
                      ? "bg-card text-white shadow-sm"
                      : "text-zinc-400 hover:text-white")
                  }
                >
                  Custom
                  <svg
                    className={
                      "w-3 h-3 transition-transform " +
                      (customOpen ? "rotate-180" : "")
                    }
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Button>
                {customOpen && (
                  <div className="absolute right-0 mt-2 z-30 bg-card border border-line rounded-2xl shadow-lg p-4 w-64 space-y-3">
                    <div>
                      <Label className="block text-xs font-bold text-zinc-500 mb-1 font-normal">
                        From
                      </Label>
                      <Input
                        type="date"
                        value={customFrom}
                        max={customTo || undefined}
                        onChange={(e) => {
                          if (onCustomFromChange) onCustomFromChange(e.target.value);
                        }}
                        className="w-full h-auto border-line rounded-full px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="block text-xs font-bold text-zinc-500 mb-1 font-normal">
                        To
                      </Label>
                      <Input
                        type="date"
                        value={customTo}
                        min={customFrom || undefined}
                        onChange={(e) => {
                          if (onCustomToChange) onCustomToChange(e.target.value);
                        }}
                        className="w-full h-auto border-line rounded-full px-3 py-1.5 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      onClick={onApplyCustom ? () => onApplyCustom() : undefined}
                      disabled={!customFrom || !customTo}
                      className="w-full h-auto text-sm bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full px-3 py-1.5 font-bold"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              title="Filter"
              className="w-9 h-9 p-0 border border-line bg-card hover:bg-black rounded-full text-zinc-400"
              aria-label="Filter"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </Button>
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-400 font-bold">
            No {view === "sales" ? "sales" : "technician"} revenue in this
            window yet. Assign staff to jobs in the schedule.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent text-xs font-bold text-zinc-500">
                  <TableHead className="h-auto text-left px-5 py-3 text-xs font-bold text-zinc-500">Rank</TableHead>
                  <TableHead className="h-auto text-left px-5 py-3 text-xs font-bold text-zinc-500">
                    {personColumn}
                  </TableHead>
                  <TableHead className="h-auto text-left px-5 py-3 text-xs font-bold text-zinc-500">Role</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-xs font-bold text-zinc-500">Revenue</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-xs font-bold text-zinc-500">Jobs</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-xs font-bold text-zinc-500">{avgColumn}</TableHead>
                  <TableHead className="h-auto text-right px-5 py-3 text-xs font-bold text-zinc-500">{lastColumn}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const isMe = meId === r.id;
                  const isTop = i === 0;
                  return (
                    <TableRow
                      key={r.id}
                      onClick={onRowClick ? () => onRowClick(r.id) : undefined}
                      className={
                        "border-t border-b-0 border-line cursor-pointer hover:bg-black " +
                        (isMe
                          ? "bg-amber-50/60 ring-1 ring-amber-200"
                          : isTop
                          ? "bg-amber-50/30"
                          : "")
                      }
                    >
                      <TableCell className="px-5 py-3">
                        <span
                          className={
                            "inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm " +
                            rankBadgeClass(i)
                          }
                        >
                          {i + 1}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs overflow-hidden " +
                              (r.photo_url ? "" : avatarColor(r.name))
                            }
                          >
                            {r.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.photo_url}
                                alt={r.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              initials(r.name)
                            )}
                          </div>
                          <span className="font-bold text-white tracking-tight">
                            {r.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <span
                          className={
                            "text-xs px-2.5 py-1 rounded-full font-bold " +
                            roleBadgeClass(r.role)
                          }
                        >
                          {r.role || "Staff"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-right font-extrabold text-white tracking-tight tabular-nums">
                        {money(r.revenue_cents)}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                        {r.job_count}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-right text-zinc-300 font-bold tabular-nums">
                        {money(
                          r.job_count > 0
                            ? Math.round(r.revenue_cents / r.job_count)
                            : 0
                        )}
                      </TableCell>
                      <TableCell
                        className="px-5 py-3 text-right text-white tabular-nums whitespace-nowrap"
                        suppressHydrationWarning
                      >
                        {formatDate(r.last_sale_at, mounted)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
