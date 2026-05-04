"use client";

import { useState } from "react";
import {
  ACCENT,
  ACCENT_SOFT,
  Donut,
  LegendDot,
  PreviewBar,
  Range,
  RangePills,
  SplitDonut,
  TRACK,
  VARIANT_LIST,
  money,
  pct,
  useDailyRevenue,
} from "../_shared";
import type { ReportsOverview } from "../../concept-live/_data";

export default function BalancedMixView({
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

  const completed = overview.jobs.completed;
  const scheduled = overview.jobs.scheduled;
  const canceled = overview.jobs.cancelled;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <PreviewBar letter="C" name="Balanced mix" letters={VARIANT_LIST} />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Reports</h1>
            <p className="text-sm text-zinc-500 mt-2 font-bold">
              {monthLabel} overview
            </p>
          </div>
          <RangePills range={range} setRange={setRange} />
        </header>

        {/* Hero: chart 2/3 + collection donut 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <section className="lg:col-span-2 bg-white border border-zinc-200 rounded-3xl p-7">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
                  {data?.label ?? "Revenue"}
                </div>
                <div className="text-[40px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
                  {data ? money(data.total_cents) : "—"}
                </div>
                <span
                  className="inline-block mt-3 h-1 w-10 rounded-full"
                  style={{ background: ACCENT }}
                />
              </div>
            </div>
            {loading && !data ? (
              <div className="h-[260px] animate-pulse bg-zinc-100 rounded-xl" />
            ) : (
              <SmoothArea days={data?.days ?? []} height={260} />
            )}
          </section>

          <section className="bg-white border border-zinc-200 rounded-3xl p-7 flex flex-col items-center text-center">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-5 self-stretch text-left">
              Collection Rate
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <Donut
                value={overview.revenue.collection_rate}
                label={pct(overview.revenue.collection_rate)}
                size={170}
                stroke={20}
              />
              <div className="mt-5 text-sm text-zinc-500 font-bold">
                {money(overview.revenue.collected_cents)} of{" "}
                {money(overview.revenue.total_cents)}
              </div>
            </div>
          </section>
        </div>

        {/* Revenue trio */}
        <Section title="Revenue">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi label="Total Revenue" value={money(overview.revenue.total_cents)} />
            <Kpi label="Collected" value={money(overview.revenue.collected_cents)} />
            <Kpi label="Unpaid" value={money(overview.revenue.unpaid_cents)} />
          </div>
        </Section>

        {/* Jobs: donut + numeric breakdown side-by-side */}
        <Section title="Jobs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col items-center text-center">
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
              <div className="mt-5 grid grid-cols-3 gap-3 w-full">
                <LegendDot color={ACCENT} label="Completed" value={completed} />
                <LegendDot color={ACCENT_SOFT} label="Scheduled" value={scheduled} />
                <LegendDot color={TRACK} label="Canceled" value={canceled} />
              </div>
            </section>
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <Kpi label="Total Jobs" value={String(overview.jobs.total)} />
              <Kpi label="Avg Job Value" value={money(overview.jobs.avg_value_cents)} />
              <Kpi label="Completed" value={String(overview.jobs.completed)} />
              <Kpi label="Scheduled" value={String(overview.jobs.scheduled)} />
            </div>
          </div>
        </Section>

        <Section title="Customers" last>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi label="Total Customers" value={String(overview.customers.total)} />
            <Kpi label="New Customers" value={String(overview.customers.new)} />
            <Kpi label="Repeat Customers" value={String(overview.customers.repeat)} />
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
    <div className="bg-white border border-zinc-200 rounded-3xl p-6">
      <div className="text-[12.5px] font-bold text-zinc-500">{label}</div>
      <div className="text-[28px] font-extrabold tracking-tight tabular-nums leading-none mt-2">
        {value}
      </div>
      <span
        className="inline-block mt-3 h-0.5 w-8 rounded-full"
        style={{ background: ACCENT }}
      />
    </div>
  );
}

function SmoothArea({
  days,
  height = 260,
}: {
  days: { date: string; cents: number }[];
  height?: number;
}) {
  if (days.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-zinc-400 font-bold"
        style={{ height }}
      >
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = height;
  const padL = 0;
  const padR = 0;
  const padT = 6;
  const padB = 24;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const x = (i: number) =>
    padL + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => baseY - (v / max) * innerH;
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
  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bal-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.3" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bal-area)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
