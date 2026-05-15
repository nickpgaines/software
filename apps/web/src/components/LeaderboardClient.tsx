"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import NewSprintModal from "./NewSprintModal";
import SprintWidget, { type Sprint } from "./SprintWidget";
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

type View = "sales" | "tech";
type Range = "today" | "week" | "month" | "year" | "custom";

type Row = {
  id: number;
  name: string;
  role: string | null;
  photo_url: string | null;
  color: string | null;
  revenue_cents: number;
  job_count: number;
  last_sale_at: string | null;
};

type Resp = {
  range: Range;
  view: View;
  start: string;
  end: string;
  rows: Row[];
};

const PRESET_RANGES: { key: Exclude<Range, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null, mounted: boolean) {
  if (!iso) return "—";
  if (!mounted) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function rankBadgeClass(i: number) {
  if (i === 0) return "bg-amber-400 text-white";
  if (i === 1) return "bg-line-strong text-white";
  if (i === 2) return "bg-orange-300 text-white";
  return "bg-black text-zinc-400";
}

function roleBadgeClass(role: string | null) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "bg-rose-100 text-rose-600";
  if (r === "sales" || r === "salesperson") return "bg-sky-100 text-sky-700";
  if (r === "tech" || r === "technician") return "bg-emerald-100 text-emerald-700";
  return "bg-black text-zinc-400";
}

function avatarColor(name: string) {
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

function todayDateInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function LeaderboardClient({
  currentUser,
  currentStaffId,
  isAdmin,
}: {
  currentUser: string;
  currentStaffId: number | null;
  isAdmin: boolean;
}) {
  const [view, setView] = useState<View>("sales");
  const [range, setRange] = useState<Range>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>(todayDateInput());
  const [customOpen, setCustomOpen] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const router = useRouter();
  const goToStats = useCallback(
    (id: number) => {
      if (view === "tech") {
        router.push(`/tech-stats/${id}`);
      } else {
        router.push(`/sales-stats/${id}?view=sales`);
      }
    },
    [router, view]
  );

  const loadSprints = useCallback(async () => {
    try {
      const r = await fetch(`/api/sprints?view=${view}`);
      if (!r.ok) return;
      const j = (await r.json()) as { sprints: Sprint[] };
      setSprints(j.sprints || []);
    } catch {
      // ignore
    }
  }, [view]);

  useEffect(() => {
    loadSprints();
  }, [loadSprints]);

  // Refresh sprint standings periodically so revenue numbers stay current.
  useEffect(() => {
    const t = setInterval(loadSprints, 60_000);
    return () => clearInterval(t);
  }, [loadSprints]);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ view, range });
    if (range === "custom") {
      params.set("from", new Date(`${customFrom}T00:00:00`).toISOString());
      const end = new Date(`${customTo}T00:00:00`);
      end.setDate(end.getDate() + 1);
      params.set("to", end.toISOString());
    }
    fetch(`/api/leaderboard?${params}`)
      .then((r) => r.json())
      .then((d: Resp) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, range, customFrom, customTo]);

  const customRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!customRef.current?.contains(e.target as Node)) setCustomOpen(false);
    }
    if (customOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [customOpen]);

  const activeRows = useMemo(
    () => (data ? data.rows.filter((r) => r.job_count > 0) : []),
    [data]
  );

  const total = activeRows.reduce((a, r) => a + r.revenue_cents, 0);
  const totalJobs = activeRows.reduce((a, r) => a + r.job_count, 0);
  const top = activeRows[0] || null;

  const me = useMemo(() => {
    if (!data) return null;
    if (currentStaffId != null) {
      const byId = data.rows.find((r) => r.id === currentStaffId);
      if (byId) return byId;
    }
    const u = currentUser.trim().toLowerCase();
    if (u) {
      const exact = data.rows.find((r) => r.name.trim().toLowerCase() === u);
      if (exact) return exact;
    }
    return null;
  }, [data, currentUser, currentStaffId]);
  const myRank = me ? activeRows.findIndex((r) => r.id === me.id) + 1 : null;
  const meName = me?.name || (currentUser ? currentUser : "You");
  const meRevenue = me?.revenue_cents ?? total;
  const meIsFallback = !me;

  const title = view === "sales" ? "Sales Leaderboard" : "Technician Leaderboard";
  const personColumn = view === "sales" ? "SALESPERSON" : "TECHNICIAN";
  const avgColumn = view === "sales" ? "AVG DEAL" : "AVG JOB";
  const lastColumn = view === "sales" ? "LAST SALE" : "LAST JOB";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-page-title text-white">{title}</h1>
        <div className="flex items-center gap-1 bg-black rounded-full p-1 text-sm">
          <Button
            variant="ghost"
            onClick={() => setView("sales")}
            className={
              "h-auto px-4 py-1.5 rounded-full font-bold hover:bg-transparent " +
              (view === "sales"
                ? "bg-card text-white shadow-sm"
                : "text-zinc-400 hover:text-white")
            }
          >
            Sales
          </Button>
          <Button
            variant="ghost"
            onClick={() => setView("tech")}
            className={
              "h-auto px-4 py-1.5 rounded-full font-bold hover:bg-transparent " +
              (view === "tech"
                ? "bg-card text-white shadow-sm"
                : "text-zinc-400 hover:text-white")
            }
          >
            Technicians
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={() => setShowNewSprint(true)}
            className="h-auto text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 gap-2 text-zinc-300 font-bold"
          >
            <span className="text-lg leading-none">+</span> Start a sprint
          </Button>
        </div>
      )}

      {sprints.length > 0 && (
        <div className="space-y-3">
          {sprints.map((s) => (
            <SprintWidget
              key={s.id}
              sprint={s}
              isAdmin={isAdmin}
              onDeleted={loadSprints}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          if (me) goToStats(me.id);
          else {
            const el = document.getElementById("rankings");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }
        }}
        className="w-full h-auto text-left flex items-center gap-3 justify-start bg-card border border-line rounded-2xl px-5 py-4 hover:bg-black shadow-sm whitespace-normal"
      >
        <div
          className={
            "w-12 h-12 rounded-full flex items-center justify-center font-semibold text-base overflow-hidden " +
            (me?.photo_url ? "" : "bg-amber-100 text-amber-700")
          }
        >
          {me?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.photo_url}
              alt={meName}
              className="w-full h-full object-cover"
            />
          ) : (
            initials(meName)
          )}
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-white tracking-tight">Your Stats</div>
          <div className="text-sm text-zinc-400 font-bold">
            {money(meRevenue)} {view === "sales" ? "sold" : "cleaned"}
            {myRank
              ? ` · Rank #${myRank}`
              : meIsFallback
              ? " · Add yourself on the Team page to track personal rank"
              : ""}
          </div>
        </div>
        <span className="text-zinc-500 text-2xl leading-none">›</span>
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Revenue" value={money(total)} />
        <KpiCard label="Total Jobs" value={String(totalJobs)} />
        <KpiCard label="Top Performer" value={top?.name || "—"} />
      </div>

      <div id="rankings" className="bg-card border border-line rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="font-extrabold text-white tracking-tight">
              {view === "sales" ? "Sales Rankings" : "Technician Rankings"}
            </h2>
            <span className="inline-flex items-center gap-1.5 bg-sky-50 border border-sky-100 text-sky-700 text-xs px-2.5 py-1 rounded-full">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Teams
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black border border-line rounded-full p-1 text-sm">
              {PRESET_RANGES.map((r) => (
                <Button
                  key={r.key}
                  variant="ghost"
                  onClick={() => {
                    setRange(r.key);
                    setCustomOpen(false);
                  }}
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
                  onClick={() => {
                    setRange("custom");
                    setCustomOpen((o) => !o);
                  }}
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
                        onChange={(e) => setCustomFrom(e.target.value)}
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
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full h-auto border-line rounded-full px-3 py-1.5 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setCustomOpen(false)}
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

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading…</div>
        ) : activeRows.length === 0 ? (
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
                {activeRows.map((r, i) => {
                  const isMe = me?.id === r.id;
                  const isTop = i === 0;
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => goToStats(r.id)}
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
                        {money(Math.round(r.revenue_cents / r.job_count))}
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

      {showNewSprint && (
        <NewSprintModal
          view={view}
          onClose={() => setShowNewSprint(false)}
          onCreated={() => {
            setShowNewSprint(false);
            loadSprints();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="text-[14px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
