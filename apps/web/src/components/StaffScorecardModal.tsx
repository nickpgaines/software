"use client";

import { useEffect, useState } from "react";

type Range = "today" | "week" | "month" | "year" | "custom";
type View = "sales" | "tech";

type Scorecard = {
  staff: {
    id: number;
    name: string;
    role: string | null;
    photo_url: string | null;
  };
  range: Range;
  view: View;
  start: string;
  end: string;
  subscriptions: {
    arr_cents: number;
    count: number;
    avg_value_cents: number;
  };
  one_time: {
    revenue_cents: number;
    count: number;
    avg_value_cents: number;
  };
  pins: {
    total: number;
    qualified: number;
    counts: Record<string, number>;
    conversion_rate: number;
  };
};

const PRESETS: { key: Exclude<Range, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const PIN_DEFS: { key: string; label: string; color: string }[] = [
  { key: "sale", label: "Sale", color: "bg-emerald-500" },
  { key: "not_home", label: "Not Home", color: "bg-orange-500" },
  { key: "not_interested", label: "Not Interested", color: "bg-rose-500" },
  { key: "not_qualified", label: "Not Qualified", color: "bg-violet-500" },
  { key: "do_not_contact", label: "Do Not Contact", color: "bg-slate-700" },
  { key: "revisit", label: "Revisit", color: "bg-cyan-500" },
  { key: "referral", label: "Referral", color: "bg-pink-500" },
  { key: "quote", label: "Quote", color: "bg-blue-500" },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function moneyShort(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StaffScorecardModal({
  staffId,
  defaultView,
  onClose,
}: {
  staffId: number;
  defaultView: View;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>(defaultView);
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ view, range });
    fetch(`/api/staff/${staffId}/scorecard?${params}`)
      .then((r) => r.json())
      .then((d: Scorecard) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId, view, range]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const staff = data?.staff;
  const subs = data?.subscriptions;
  const ot = data?.one_time;
  const pins = data?.pins;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl my-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-4">
          <div
            className={
              "w-14 h-14 rounded-full flex items-center justify-center font-semibold text-base overflow-hidden " +
              (staff?.photo_url ? "" : "bg-amber-100 text-amber-700")
            }
          >
            {staff?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={staff.photo_url}
                alt={staff.name}
                className="w-full h-full object-cover"
              />
            ) : (
              initials(staff?.name || "")
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-sky-500 font-semibold">
              Sales Stats
            </div>
            <h2 className="text-2xl font-bold text-slate-900 truncate">
              {staff?.name || "—"}
              <span className="text-slate-400 font-medium">
                {" "}
                · {moneyShort((subs?.arr_cents || 0) + (ot?.revenue_cents || 0))}{" "}
                this period
              </span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {staff?.role && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-rose-100 text-rose-600 capitalize">
                  {staff.role}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-xs">
              <button
                onClick={() => setView("sales")}
                className={
                  "px-3 py-1 rounded-full transition " +
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
                  "px-3 py-1 rounded-full transition " +
                  (view === "tech"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900")
                }
              >
                Tech
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 flex justify-end">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full p-1 text-xs">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setRange(p.key)}
                className={
                  "px-3 py-1 rounded-full transition whitespace-nowrap " +
                  (range === p.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-lg font-bold text-slate-900 mb-3">
                Subscriptions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat
                  label="ARR Sold"
                  value={money(subs?.arr_cents || 0)}
                  help="New ARR booked in this period"
                />
                <Stat
                  label="Subscriptions Sold"
                  value={String(subs?.count || 0)}
                  help="Recurring services booked"
                />
                <Stat
                  label="Avg Sub Value"
                  value={money(subs?.avg_value_cents || 0)}
                  help="Annualized per subscription"
                />
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-slate-900 mb-3">
                One-Time Cleans
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat
                  label="Total Revenue"
                  value={money(ot?.revenue_cents || 0)}
                  help="From jobs sold in period"
                />
                <Stat
                  label="Jobs Sold"
                  value={String(ot?.count || 0)}
                  help={ot?.count ? "" : "No jobs yet"}
                />
                <Stat
                  label="Avg Job Value"
                  value={money(ot?.avg_value_cents || 0)}
                  help="Average per job"
                />
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-slate-900 mb-3">
                Door Knocks
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Stat
                  label="Conversion Rate"
                  value={`${((pins?.conversion_rate || 0) * 100).toFixed(1)}%`}
                  help={`${pins?.counts.sale || 0} sales from ${
                    pins?.qualified || 0
                  } qualified pins`}
                />
                <Stat
                  label="Total Pins"
                  value={String(pins?.total || 0)}
                  help="All pins dropped in this range"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PIN_DEFS.map((p) => {
                  const count = pins?.counts[p.key] || 0;
                  const total = pins?.total || 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div
                      key={p.key}
                      className="border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span
                          className={"w-2 h-2 rounded-full " + p.color}
                        />
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums leading-tight mt-1">
                        {count}
                      </div>
                      <div className="text-xs text-slate-500">{p.label}</div>
                      <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={p.color + " h-full"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-xl px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
        {value}
      </div>
      {help ? <div className="text-xs text-slate-500 mt-0.5">{help}</div> : null}
    </div>
  );
}
