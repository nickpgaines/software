"use client";

import { useState } from "react";
import {
  ACCENT,
  ACCENT_SOFT,
  Day,
  LegendDot,
  PreviewBar,
  Range,
  RangePills,
  Spark,
  SplitDonut,
  TRACK,
  VARIANT_LIST,
  money,
  pct,
  useDailyRevenue,
} from "../_shared";
import type { ReportsOverview } from "../../concept-live/_data";

export default function CompactDashboardView({
  overview,
}: {
  overview: ReportsOverview;
}) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const [range, setRange] = useState<Range>("1m");
  const { data, loading } = useDailyRevenue(range);
  const days = data?.days ?? [];

  // Per-metric sparkline series shaped from daily revenue.
  const collectedDays: Day[] = days.map((d) => ({
    date: d.date,
    cents: Math.round(d.cents * (overview.revenue.collection_rate || 0)),
  }));
  const unpaidDays: Day[] = days.map((d) => ({
    date: d.date,
    cents: d.cents - Math.round(d.cents * (overview.revenue.collection_rate || 0)),
  }));

  const completed = overview.jobs.completed;
  const scheduled = overview.jobs.scheduled;
  const canceled = overview.jobs.cancelled;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <PreviewBar letter="D" name="Compact dashboard" letters={VARIANT_LIST} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-7 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Reports</h1>
            <p className="text-sm text-zinc-500 mt-1.5 font-bold">
              {monthLabel} overview
            </p>
          </div>
          <RangePills range={range} setRange={setRange} />
        </header>

        {/* Revenue KPI strip with sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <SparkKpi
            label="Total Revenue"
            value={money(overview.revenue.total_cents)}
            days={days}
          />
          <SparkKpi
            label="Collected"
            value={money(overview.revenue.collected_cents)}
            days={collectedDays}
          />
          <SparkKpi
            label="Unpaid"
            value={money(overview.revenue.unpaid_cents)}
            days={unpaidDays}
          />
          <RatioKpi
            label="Collection Rate"
            value={pct(overview.revenue.collection_rate)}
            ratio={overview.revenue.collection_rate}
          />
        </div>

        {/* Big chart */}
        <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
                {data?.label ?? "Revenue"}
              </div>
              <div className="text-[32px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
                {data ? money(data.total_cents, 0) : "—"}
              </div>
            </div>
          </div>
          {loading && !data ? (
            <div className="h-[240px] animate-pulse bg-zinc-100 rounded-lg" />
          ) : (
            <BigArea days={days} />
          )}
        </section>

        {/* Jobs: donut + KPI strip side-by-side */}
        <Section title="Jobs">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
            <section className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col items-center text-center">
              <SplitDonut
                segments={[
                  { value: completed, color: ACCENT },
                  { value: scheduled, color: ACCENT_SOFT },
                  { value: canceled, color: TRACK },
                ]}
                size={160}
                stroke={18}
                centerLabel={String(overview.jobs.total)}
                centerSub="JOBS"
              />
              <div className="mt-4 grid grid-cols-3 gap-2.5 w-full">
                <LegendDot color={ACCENT} label="Done" value={completed} />
                <LegendDot color={ACCENT_SOFT} label="Sched" value={scheduled} />
                <LegendDot color={TRACK} label="Canc" value={canceled} />
              </div>
            </section>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              <Kpi label="Total Jobs" value={String(overview.jobs.total)} />
              <Kpi label="Completed" value={String(overview.jobs.completed)} />
              <Kpi label="Scheduled" value={String(overview.jobs.scheduled)} />
              <Kpi label="Canceled" value={String(overview.jobs.cancelled)} />
              <Kpi
                label="Avg Job Value"
                value={money(overview.jobs.avg_value_cents)}
              />
            </div>
          </div>
        </Section>

        <Section title="Customers" last>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi label="Total Customers" value={String(overview.customers.total)} />
            <Kpi label="New Customers" value={String(overview.customers.new)} />
            <Kpi
              label="Repeat Customers"
              value={String(overview.customers.repeat)}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "mb-6"}>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
          {title}
        </h3>
        <span className="h-px flex-1 bg-zinc-300" />
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-[12px] font-bold text-zinc-500">{label}</div>
      <div className="text-[24px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
        {value}
      </div>
      <span
        className="inline-block mt-2.5 h-0.5 w-7 rounded-full"
        style={{ background: ACCENT }}
      />
    </div>
  );
}

function SparkKpi({
  label,
  value,
  days,
}: {
  label: string;
  value: string;
  days: Day[];
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-[12px] font-bold text-zinc-500">{label}</div>
      <div className="text-[24px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
        {value}
      </div>
      <div className="mt-2 h-9">
        <Spark days={days} />
      </div>
    </div>
  );
}

function RatioKpi({
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
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-[12px] font-bold text-zinc-500">{label}</div>
      <div className="text-[24px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
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

function BigArea({ days }: { days: Day[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-zinc-400 font-bold">
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 240;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const niceMax = niceCeil(max);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const x = (i: number) =>
    padL + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => baseY - (v / niceMax) * innerH;
  let path = `M ${x(0)},${y(days[0].cents)}`;
  for (let i = 0; i < days.length - 1; i++) {
    const x0 = x(i);
    const y0 = y(days[i].cents);
    const x1 = x(i + 1);
    const y1 = y(days[i + 1].cents);
    const cx = (x0 + x1) / 2;
    path += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${path} L ${x(days.length - 1)},${baseY} L ${x(0)},${baseY} Z`;
  const ticks = [0, niceMax / 2, niceMax];
  const everyN = Math.max(1, Math.ceil(days.length / 10));
  return (
    <div className="w-full h-[240px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cd-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.3" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick, i) => {
          const yp = y(tick);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={w - padR}
                y1={yp}
                y2={yp}
                stroke="#e4e4e7"
                strokeDasharray="2 4"
              />
              <text
                x={padL - 6}
                y={yp + 3}
                textAnchor="end"
                fontSize="10"
                fontWeight="700"
                fill="#a1a1aa"
              >
                {Math.round(tick / 100)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#cd-area)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {days.map((d, i) =>
          i % everyN === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={h - 6}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#a1a1aa"
            >
              {new Date(`${d.date}T12:00:00`).getDate()}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const mag = Math.pow(10, exp);
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
