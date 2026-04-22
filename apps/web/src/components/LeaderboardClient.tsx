"use client";

import { useEffect, useMemo, useState } from "react";

type View = "sales" | "tech";
type Range = "today" | "week" | "month" | "year" | "all";

type Row = {
  id: number;
  name: string;
  role: string | null;
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

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
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

export default function LeaderboardClient({
  currentUser,
}: {
  currentUser: string;
}) {
  const [view, setView] = useState<View>("sales");
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leaderboard?view=${view}&range=${range}`)
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
  }, [view, range]);

  const activeRows = useMemo(
    () => (data ? data.rows.filter((r) => r.job_count > 0) : []),
    [data]
  );

  const total = activeRows.reduce((a, r) => a + r.revenue_cents, 0);
  const totalJobs = activeRows.reduce((a, r) => a + r.job_count, 0);
  const top = activeRows[0] || null;

  const me = useMemo(() => {
    if (!data) return null;
    const u = currentUser.trim().toLowerCase();
    const match = data.rows.find((r) => r.name.trim().toLowerCase() === u);
    return match || null;
  }, [data, currentUser]);
  const myRank = me
    ? activeRows.findIndex((r) => r.id === me.id) + 1
    : null;

  const title = view === "sales" ? "Sales Leaderboard" : "Technician Leaderboard";
  const roleColumnHeader = view === "sales" ? "SALESPERSON" : "TECHNICIAN";
  const avgColumnHeader = view === "sales" ? "AVG DEAL" : "AVG JOB";
  const lastColumnHeader = view === "sales" ? "LAST SALE" : "LAST JOB";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">{title}</h1>
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
      </div>

      <div className="flex justify-end">
        <button className="text-sm border border-slate-200 bg-white hover:bg-slate-50 rounded-full px-4 py-2 flex items-center gap-2 text-slate-700">
          <span className="text-lg leading-none">+</span> Start a sprint
        </button>
      </div>

      {me && (
        <a
          href="#rankings"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:bg-slate-50"
        >
          <div
            className={
              "w-10 h-10 rounded-full flex items-center justify-center font-semibold " +
              avatarColor(me.name)
            }
          >
            {initials(me.name)}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-slate-900">Your Stats</div>
            <div className="text-sm text-slate-500">
              {money(me.revenue_cents)} {view === "sales" ? "sold" : "cleaned"}
              {myRank ? ` · Rank #${myRank}` : ""}
            </div>
          </div>
          <span className="text-slate-300 text-xl">›</span>
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Revenue" value={money(total)} />
        <KpiCard label="Total Jobs" value={String(totalJobs)} />
        <KpiCard label="Top Performer" value={top?.name || "—"} />
      </div>

      <div id="rankings" className="bg-white border border-slate-200 rounded-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-900">
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
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full p-1 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
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
          </div>
        </div>

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : activeRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No {view === "sales" ? "sales" : "technician"} revenue in this
            window yet. Assign staff to jobs in the schedule.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Rank</th>
                  <th className="text-left px-5 py-3 font-medium">
                    {roleColumnHeader}
                  </th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-right px-5 py-3 font-medium">Revenue</th>
                  <th className="text-right px-5 py-3 font-medium">Jobs</th>
                  <th className="text-right px-5 py-3 font-medium">
                    {avgColumnHeader}
                  </th>
                  <th className="text-right px-5 py-3 font-medium">
                    {lastColumnHeader}
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r, i) => {
                  const isMe = me?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={
                        "border-t border-slate-100 " +
                        (isMe ? "bg-amber-50/60" : "")
                      }
                    >
                      <td className="px-5 py-3">
                        <span
                          className={
                            "inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm " +
                            rankBadgeClass(i)
                          }
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs " +
                              avatarColor(r.name)
                            }
                          >
                            {initials(r.name)}
                          </div>
                          <span className="font-medium text-slate-900">
                            {r.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            "text-xs px-2.5 py-1 rounded-full font-medium " +
                            roleBadgeClass(r.role)
                          }
                        >
                          {r.role || "Staff"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                        {money(r.revenue_cents)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                        {r.job_count}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                        {money(Math.round(r.revenue_cents / r.job_count))}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDate(r.last_sale_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 min-h-[130px] flex flex-col justify-between">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="text-3xl font-bold text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
