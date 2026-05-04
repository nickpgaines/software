"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import StaffScorecardModal from "./StaffScorecardModal";
import NewSprintModal from "./NewSprintModal";
import SprintWidget, { type Sprint } from "./SprintWidget";

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
  if (i === 1) return "bg-slate-300 text-white";
  if (i === 2) return "bg-orange-300 text-white";
  return "bg-slate-100 text-slate-500";
}

function roleBadgeClass(role: string | null) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "bg-rose-100 text-rose-600";
  if (r === "sales" || r === "salesperson") return "bg-sky-100 text-sky-700";
  if (r === "tech" || r === "technician") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
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
  const [scorecardId, setScorecardId] = useState<number | null>(null);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [search, setSearch] = useState("");

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.role || "").toLowerCase().includes(q)
    );
  }, [activeRows, search]);

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

  const titleLead = view === "sales" ? "Sales" : "Technician";
  const personColumn = view === "sales" ? "SALESPERSON" : "TECHNICIAN";
  const avgColumn = view === "sales" ? "AVG DEAL" : "AVG JOB";
  const lastColumn = view === "sales" ? "LAST SALE" : "LAST JOB";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            {titleLead} <span className="text-sky-400">Leaderboard</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track your team&apos;s performance
          </p>
        </div>
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="bg-white border border-slate-200 rounded-full pl-10 pr-16 py-2.5 text-sm w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-sm">
          <button
            onClick={() => setView("sales")}
            className={
              "px-4 py-1.5 rounded-full transition " +
              (view === "sales"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900")
            }
          >
            Sales
          </button>
          <button
            onClick={() => setView("tech")}
            className={
              "px-4 py-1.5 rounded-full transition " +
              (view === "tech"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900")
            }
          >
            Technicians
          </button>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewSprint(true)}
            className="text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 py-2 flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Start a sprint
          </button>
        )}
      </div>

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

      <button
        type="button"
        onClick={() => {
          if (me) setScorecardId(me.id);
          else {
            const el = document.getElementById("rankings");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }
        }}
        className="w-full text-left flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-6 hover:bg-slate-50"
      >
        <div
          className={
            "w-14 h-14 rounded-full flex items-center justify-center font-semibold text-lg overflow-hidden " +
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
          <div className="text-lg font-semibold text-slate-900">Your Stats</div>
          <div className="text-sm text-slate-500 mt-0.5">
            {money(meRevenue)} {view === "sales" ? "sold" : "cleaned"}
            {myRank
              ? ` · Rank #${myRank}`
              : meIsFallback
              ? " · Add yourself on the Team page to track personal rank"
              : ""}
          </div>
        </div>
        <span className="text-slate-300 text-2xl leading-none">›</span>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Revenue" value={money(total)} />
        <KpiCard label="Total Jobs" value={String(totalJobs)} />
        <KpiCard label="Top Performer" value={top?.name || "—"} />
      </div>

      <div id="rankings" className="bg-white border border-slate-200 rounded-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
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
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full p-1 text-sm">
              {PRESET_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setRange(r.key);
                    setCustomOpen(false);
                  }}
                  className={
                    "px-3 py-1 rounded-full transition whitespace-nowrap " +
                    (range === r.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900")
                  }
                >
                  {r.label}
                </button>
              ))}
              <div ref={customRef} className="relative">
                <button
                  onClick={() => {
                    setRange("custom");
                    setCustomOpen((o) => !o);
                  }}
                  className={
                    "px-3 py-1 rounded-full transition whitespace-nowrap inline-flex items-center gap-1 " +
                    (range === "custom"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900")
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
                </button>
                {customOpen && (
                  <div className="absolute right-0 mt-2 z-30 bg-white border border-slate-200 rounded-2xl shadow-lg p-4 w-64 space-y-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                        From
                      </label>
                      <input
                        type="date"
                        value={customFrom}
                        max={customTo || undefined}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full border border-slate-200 rounded-full px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                        To
                      </label>
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom || undefined}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full border border-slate-200 rounded-full px-3 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => setCustomOpen(false)}
                      disabled={!customFrom || !customTo}
                      className="w-full text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-3 py-1.5"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              title="Filter"
              className="w-9 h-9 border border-slate-200 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center text-slate-500"
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
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : activeRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No {view === "sales" ? "sales" : "technician"} revenue in this
            window yet. Assign staff to jobs in the schedule.
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No matches for &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400">
                  <th className="text-left px-6 py-3 font-medium">Rank</th>
                  <th className="text-left px-6 py-3 font-medium">
                    {personColumn}
                  </th>
                  <th className="text-left px-6 py-3 font-medium">Role</th>
                  <th className="text-right px-6 py-3 font-medium">Revenue</th>
                  <th className="text-right px-6 py-3 font-medium">Jobs</th>
                  <th className="text-right px-6 py-3 font-medium">{avgColumn}</th>
                  <th className="text-right px-6 py-3 font-medium">{lastColumn}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const i = activeRows.findIndex((x) => x.id === r.id);
                  const isMe = me?.id === r.id;
                  const isTop = i === 0;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setScorecardId(r.id)}
                      className={
                        "border-t border-slate-100 cursor-pointer hover:bg-slate-50 " +
                        (isMe
                          ? "bg-amber-50/60 ring-1 ring-amber-200"
                          : isTop
                          ? "bg-amber-50/30"
                          : "")
                      }
                    >
                      <td className="px-6 py-4">
                        <span
                          className={
                            "inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm " +
                            rankBadgeClass(i)
                          }
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
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
                          <span className="font-medium text-slate-900">
                            {r.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={
                            "text-xs px-2.5 py-1 rounded-full font-medium " +
                            roleBadgeClass(r.role)
                          }
                        >
                          {r.role || "Staff"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900 tabular-nums">
                        {money(r.revenue_cents)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700 tabular-nums">
                        {r.job_count}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700 tabular-nums">
                        {money(Math.round(r.revenue_cents / r.job_count))}
                      </td>
                      <td
                        className="px-6 py-4 text-right text-slate-900 tabular-nums whitespace-nowrap"
                        suppressHydrationWarning
                      >
                        {formatDate(r.last_sale_at, mounted)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scorecardId !== null && (
        <StaffScorecardModal
          staffId={scorecardId}
          defaultView={view}
          onClose={() => setScorecardId(null)}
        />
      )}
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 min-h-[160px] flex flex-col justify-between">
      <div className="text-lg font-semibold text-slate-900">{label}</div>
      <div className="text-4xl sm:text-5xl font-bold text-slate-900 mt-2 tabular-nums truncate">
        {value}
      </div>
    </div>
  );
}
