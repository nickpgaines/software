"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
        className="bg-card border border-line rounded-2xl w-full max-w-3xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-line flex items-start gap-4">
          <div
            className={
              "w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-base overflow-hidden " +
              (staff?.photo_url ? "" : "bg-elevated text-fg-muted")
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
            <div className="text-eyebrow-tight uppercase text-fg-muted">
              Sales Stats
            </div>
            <h2 className="text-page-title text-white truncate">
              {staff?.name || "—"}
              <span className="text-zinc-500 font-bold">
                {" "}
                · {moneyShort((subs?.arr_cents || 0) + (ot?.revenue_cents || 0))}{" "}
                this period
              </span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {staff?.role && (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-elevated border border-line text-fg-muted capitalize">
                  {staff.role}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black rounded-full p-1 text-xs">
              <Button
                variant="ghost"
                onClick={() => setView("sales")}
                className={
                  "h-auto px-3 py-1 rounded-full hover:bg-transparent font-bold " +
                  (view === "sales"
                    ? "bg-card text-white"
                    : "text-zinc-400 hover:text-white")
                }
              >
                Sales
              </Button>
              <Button
                variant="ghost"
                onClick={() => setView("tech")}
                className={
                  "h-auto px-3 py-1 rounded-full hover:bg-transparent font-bold " +
                  (view === "tech"
                    ? "bg-card text-white"
                    : "text-zinc-400 hover:text-white")
                }
              >
                Tech
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-8 h-8 p-0 rounded-full hover:bg-black text-zinc-400"
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
            </Button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-line flex justify-end">
          <div className="flex items-center gap-1 bg-black border border-line rounded-full p-1 text-xs">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant="ghost"
                onClick={() => setRange(p.key)}
                className={
                  "h-auto px-3 py-1 rounded-full whitespace-nowrap font-bold hover:bg-transparent " +
                  (range === p.key
                    ? "bg-card text-white"
                    : "text-zinc-400 hover:text-white")
                }
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-lg font-bold text-white mb-3">
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
              <h3 className="text-lg font-bold text-white mb-3">
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
              <h3 className="text-lg font-bold text-white mb-3">
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
                      className="border border-line rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center justify-between text-eyebrow uppercase text-zinc-500">
                        <span
                          className={"w-2 h-2 rounded-full " + p.color}
                        />
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="text-page-title text-white tabular-nums leading-tight mt-1">
                        {count}
                      </div>
                      <div className="text-xs text-zinc-400">{p.label}</div>
                      <div className="mt-1.5 h-1 bg-black rounded-full overflow-hidden">
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
    <div className="border border-line rounded-xl px-4 py-3">
      <div className="text-eyebrow uppercase text-zinc-500">{label}</div>
      <div className="text-page-title text-white tabular-nums mt-0.5">
        {value}
      </div>
      {help ? <div className="text-xs text-zinc-400 mt-0.5">{help}</div> : null}
    </div>
  );
}
