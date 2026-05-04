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

export default function SoftView({ overview }: { overview: ReportsOverview }) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const [range, setRange] = useState<Range>("1m");
  const { data } = useDailyRevenue(range);

  const jobsTotal = overview.jobs.total;
  const completed = overview.jobs.completed;
  const scheduled = overview.jobs.scheduled;
  const canceled = overview.jobs.cancelled;

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-zinc-950">
      <PreviewBar letter="D" name="Soft (donuts)" letters={VARIANT_LIST} />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-medium tracking-tight">Reports</h1>
            <p className="text-sm text-zinc-500 mt-2 font-medium">
              {monthLabel} overview
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-sm">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  "px-4 py-1.5 rounded-full text-[12px] font-medium transition " +
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

        {/* Hero row: gradient area chart + collection rate donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <SoftCard className="lg:col-span-2">
            <div className="p-7">
              <div className="flex items-baseline justify-between mb-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-400">
                    {data?.label ?? "Revenue"}
                  </div>
                  <div className="text-4xl font-medium mt-2 tabular-nums tracking-tight">
                    {data ? money(data.total_cents) : "—"}
                  </div>
                </div>
              </div>
              <GradientArea days={data?.days ?? []} />
            </div>
          </SoftCard>

          <SoftCard>
            <div className="p-7 h-full flex flex-col items-center justify-center text-center">
              <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-400 mb-4">
                Collection Rate
              </div>
              <Donut
                value={overview.revenue.collection_rate}
                label={pct(overview.revenue.collection_rate)}
              />
              <div className="mt-4 text-sm text-zinc-500 font-medium">
                {money(overview.revenue.collected_cents)} collected of{" "}
                {money(overview.revenue.total_cents)}
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Revenue numeric trio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <SoftStat label="Total Revenue" value={money(overview.revenue.total_cents)} />
          <SoftStat label="Collected" value={money(overview.revenue.collected_cents)} />
          <SoftStat label="Unpaid" value={money(overview.revenue.unpaid_cents)} />
        </div>

        {/* Jobs split donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <SoftCard className="lg:col-span-1">
            <div className="p-7 h-full flex flex-col items-center justify-center text-center">
              <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-400 mb-4">
                Jobs · {jobsTotal} total
              </div>
              <SplitDonut
                segments={[
                  { value: completed, color: ACCENT, label: "Completed" },
                  { value: scheduled, color: "#a3c8ff", label: "Scheduled" },
                  { value: canceled, color: "#e4e4e7", label: "Canceled" },
                ]}
                centerLabel={String(jobsTotal)}
                centerSub="jobs"
              />
              <div className="mt-5 grid grid-cols-3 gap-3 w-full text-left">
                <Legend color={ACCENT} label="Completed" value={completed} />
                <Legend color="#a3c8ff" label="Scheduled" value={scheduled} />
                <Legend color="#e4e4e7" label="Canceled" value={canceled} />
              </div>
            </div>
          </SoftCard>

          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-5">
            <SoftStat label="Total Jobs" value={String(overview.jobs.total)} />
            <SoftStat label="Avg Job Value" value={money(overview.jobs.avg_value_cents)} />
            <SoftStat label="Completed" value={String(overview.jobs.completed)} />
            <SoftStat label="Scheduled" value={String(overview.jobs.scheduled)} />
          </div>
        </div>

        {/* Customers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <SoftStat
            label="Total Customers"
            value={String(overview.customers.total)}
          />
          <SoftStat
            label="New Customers"
            value={String(overview.customers.new)}
          />
          <SoftStat
            label="Repeat Customers"
            value={String(overview.customers.repeat)}
          />
        </div>
      </div>
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-3xl shadow-[0_2px_24px_-12px_rgba(15,23,42,0.10)] ${className}`}
    >
      {children}
    </section>
  );
}

function SoftStat({ label, value }: { label: string; value: string }) {
  return (
    <SoftCard>
      <div className="p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-400">
          {label}
        </div>
        <div className="text-[28px] font-medium mt-2 tabular-nums tracking-tight">
          {value}
        </div>
      </div>
    </SoftCard>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500">
          {label}
        </span>
      </div>
      <div className="text-lg font-medium tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Donut({ value, label }: { value: number; label: string }) {
  const size = 160;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const dash = c * clamped;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e4e4e7"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ACCENT}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 + 8}
        textAnchor="middle"
        fontSize="26"
        fontWeight="500"
        fill="#0a0a0a"
      >
        {label}
      </text>
    </svg>
  );
}

function SplitDonut({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  centerLabel: string;
  centerSub: string;
}) {
  const size = 180;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={stroke}
        />
        <text
          x={size / 2}
          y={size / 2 + 4}
          textAnchor="middle"
          fontSize="22"
          fontWeight="500"
          fill="#0a0a0a"
        >
          {centerLabel}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 24}
          textAnchor="middle"
          fontSize="11"
          fill="#71717a"
        >
          {centerSub}
        </text>
      </svg>
    );
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const dasharray = `${len} ${c - len}`;
        const dashoffset = -offset;
        const node = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return node;
      })}
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize="28"
        fontWeight="500"
        fill="#0a0a0a"
      >
        {centerLabel}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 24}
        textAnchor="middle"
        fontSize="11"
        fill="#71717a"
      >
        {centerSub}
      </text>
    </svg>
  );
}

function GradientArea({ days }: { days: Day[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-zinc-400 font-medium">
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 220;
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
    <div className="w-full h-[220px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="soft-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#soft-area)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
