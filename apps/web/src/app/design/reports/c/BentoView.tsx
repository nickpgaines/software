"use client";

import { useState } from "react";
import {
  ACCENT,
  PreviewBar,
  VARIANT_LIST,
  money,
  pct,
  useDailyRevenue,
  type Day,
} from "../_shared";
import type { ReportsOverview } from "../../concept-live/_data";

type Range = "1w" | "1m" | "3m" | "1y";
const RANGES: { key: Range; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
];

export default function BentoView({ overview }: { overview: ReportsOverview }) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const [range, setRange] = useState<Range>("1m");
  const { data } = useDailyRevenue(range);
  const days = data?.days ?? [];

  // Build per-metric weighted sparkline arrays from the daily revenue
  // series. The shape is the same — only the magnitude scales — so each
  // card carries a meaningful relative trend without inventing data.
  const collectedDays: Day[] = days.map((d) => ({
    date: d.date,
    cents: Math.round(d.cents * (overview.revenue.collection_rate || 0)),
  }));
  const unpaidDays: Day[] = days.map((d) => ({
    date: d.date,
    cents: d.cents - Math.round(d.cents * (overview.revenue.collection_rate || 0)),
  }));

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <PreviewBar letter="C" name="Bento (sparklines)" letters={VARIANT_LIST} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-zinc-500 mt-1 font-semibold tracking-tight">
              {monthLabel} overview
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  "px-3 py-1.5 rounded-lg text-[12px] font-bold transition tracking-tight " +
                  (range === r.key
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:text-zinc-950")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {/* Revenue — sparklines */}
        <SectionLabel title="Revenue" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <SparkCard
            label="Total Revenue"
            value={money(overview.revenue.total_cents)}
            days={days}
          />
          <SparkCard
            label="Collected"
            value={money(overview.revenue.collected_cents)}
            days={collectedDays}
          />
          <SparkCard
            label="Unpaid"
            value={money(overview.revenue.unpaid_cents)}
            days={unpaidDays}
          />
          <RatioCard
            label="Collection Rate"
            value={pct(overview.revenue.collection_rate)}
            ratio={overview.revenue.collection_rate}
          />
        </div>

        <SectionLabel title="Jobs" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <NumCard label="Total Jobs" value={String(overview.jobs.total)} />
          <NumCard label="Completed" value={String(overview.jobs.completed)} />
          <NumCard label="Scheduled" value={String(overview.jobs.scheduled)} />
          <NumCard label="Canceled" value={String(overview.jobs.cancelled)} />
          <NumCard
            label="Avg Job Value"
            value={money(overview.jobs.avg_value_cents)}
          />
        </div>

        <SectionLabel title="Customers" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <NumCard label="Total Customers" value={String(overview.customers.total)} />
          <NumCard label="New Customers" value={String(overview.customers.new)} />
          <NumCard
            label="Repeat Customers"
            value={String(overview.customers.repeat)}
          />
        </div>

        {/* Combo chart at the bottom */}
        <SectionLabel title="Trend" />
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
                {data?.label ?? "Revenue"}
              </div>
              <div className="text-2xl font-bold mt-1 tabular-nums tracking-tight">
                {data ? money(data.total_cents) : "—"}
              </div>
            </div>
          </div>
          <BigSpark days={days} />
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
        {title}
      </h3>
      <span className="h-px flex-1 bg-zinc-300" />
    </div>
  );
}

function SparkCard({
  label,
  value,
  days,
}: {
  label: string;
  value: string;
  days: Day[];
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <div className="text-[11px] font-bold tracking-wide text-zinc-500 uppercase">
        {label}
      </div>
      <div className="text-[22px] font-bold mt-1 tabular-nums tracking-tight">
        {value}
      </div>
      <div className="mt-2 h-10">
        <Spark days={days} />
      </div>
    </div>
  );
}

function NumCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <div className="text-[11px] font-bold tracking-wide text-zinc-500 uppercase">
        {label}
      </div>
      <div className="text-[22px] font-bold mt-1 tabular-nums tracking-tight">
        {value}
      </div>
      <span
        className="inline-block mt-3 h-0.5 w-6 rounded-full"
        style={{ background: ACCENT }}
      />
    </div>
  );
}

function RatioCard({
  label,
  value,
  ratio,
}: {
  label: string;
  value: string;
  ratio: number;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <div className="text-[11px] font-bold tracking-wide text-zinc-500 uppercase">
        {label}
      </div>
      <div className="text-[22px] font-bold mt-1 tabular-nums tracking-tight">
        {value}
      </div>
      <div className="mt-3 h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped * 100}%`, background: ACCENT }}
        />
      </div>
    </div>
  );
}

function Spark({ days }: { days: Day[] }) {
  if (days.length === 0) return <div className="h-full bg-zinc-50 rounded" />;
  const w = 200;
  const h = 40;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const x = (i: number) =>
    days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 4) - 2;
  let path = `M ${x(0)},${y(days[0].cents)}`;
  for (let i = 1; i < days.length; i++) {
    path += ` L ${x(i)},${y(days[i].cents)}`;
  }
  const area = `${path} L ${x(days.length - 1)},${h} L ${x(0)},${h} Z`;
  const id = `sp-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.35" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BigSpark({ days }: { days: Day[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-zinc-400 font-semibold">
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 200;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const x = (i: number) =>
    days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 12) - 6;
  let path = `M ${x(0)},${y(days[0].cents)}`;
  for (let i = 1; i < days.length; i++) {
    const x0 = x(i - 1);
    const y0 = y(days[i - 1].cents);
    const x1 = x(i);
    const y1 = y(days[i].cents);
    const cx = (x0 + x1) / 2;
    path += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${path} L ${x(days.length - 1)},${h} L ${x(0)},${h} Z`;
  return (
    <div className="w-full h-[200px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="big-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.3" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#big-spark)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
