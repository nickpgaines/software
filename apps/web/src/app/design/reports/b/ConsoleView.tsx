"use client";

import { useState } from "react";
import {
  ACCENT,
  PreviewBar,
  Range,
  RangePills,
  VARIANT_LIST,
  money,
  pct,
  useDailyRevenue,
} from "../_shared";
import type { ReportsOverview } from "../../concept-live/_data";

export default function ChartForwardView({
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

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <PreviewBar letter="B" name="Chart forward" letters={VARIANT_LIST} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-7 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-5xl font-black tracking-tight leading-none">
              Reports
            </h1>
            <p className="text-sm text-zinc-500 mt-2 font-bold">
              {monthLabel} overview
            </p>
          </div>
          <RangePills range={range} setRange={setRange} />
        </header>

        {/* Revenue KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <BoldKpi label="Total Revenue" value={money(overview.revenue.total_cents)} />
          <BoldKpi label="Collected" value={money(overview.revenue.collected_cents)} />
          <BoldKpi label="Unpaid" value={money(overview.revenue.unpaid_cents)} />
          <BoldKpi label="Collection Rate" value={pct(overview.revenue.collection_rate)} />
        </div>

        {/* Big chart */}
        <section className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-zinc-500">
                {data?.label ?? "Revenue"}
              </div>
              <div className="text-[44px] font-black tracking-tight tabular-nums leading-none mt-2">
                {data ? money(data.total_cents, 0) : "—"}
              </div>
              <span
                className="inline-block mt-3 h-1 w-10 rounded-full"
                style={{ background: ACCENT }}
              />
            </div>
          </div>
          {loading && !data ? (
            <div className="h-[300px] animate-pulse bg-zinc-100 rounded-xl" />
          ) : (
            <BigArea days={data?.days ?? []} />
          )}
        </section>

        <Section title="Jobs">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <BoldKpi label="Total Jobs" value={String(overview.jobs.total)} />
            <BoldKpi label="Completed" value={String(overview.jobs.completed)} />
            <BoldKpi label="Scheduled" value={String(overview.jobs.scheduled)} />
            <BoldKpi label="Canceled" value={String(overview.jobs.cancelled)} />
            <BoldKpi
              label="Avg Job Value"
              value={money(overview.jobs.avg_value_cents)}
            />
          </div>
        </Section>

        <Section title="Customers" last>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BoldKpi label="Total Customers" value={String(overview.customers.total)} />
            <BoldKpi label="New Customers" value={String(overview.customers.new)} />
            <BoldKpi
              label="Repeat Customers"
              value={String(overview.customers.repeat)}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function BoldKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="text-[12.5px] font-bold text-zinc-500">{label}</div>
      <div className="text-[34px] font-black tracking-tight tabular-nums leading-none mt-2">
        {value}
      </div>
      <span
        className="inline-block mt-3 h-0.5 w-8 rounded-full"
        style={{ background: ACCENT }}
      />
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

function BigArea({ days }: { days: { date: string; cents: number }[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-zinc-400 font-bold">
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 300;
  const padL = 40;
  const padR = 8;
  const padT = 12;
  const padB = 28;
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
    <div className="w-full h-[300px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bf-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
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
                fontSize="11"
                fontWeight="700"
                fill="#a1a1aa"
              >
                {Math.round(tick / 100)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#bf-area)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {days.map((d, i) =>
          i % everyN === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={h - 8}
              textAnchor="middle"
              fontSize="11"
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
