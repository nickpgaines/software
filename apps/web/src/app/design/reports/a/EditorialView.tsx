"use client";

import { useState } from "react";
import {
  ACCENT,
  PreviewBar,
  VARIANT_LIST,
  money,
  pct,
  useDailyRevenue,
} from "../_shared";
import type { ReportsOverview } from "../../concept-live/_data";

type Range = "1w" | "1m" | "3m" | "1y";
const RANGES: { key: Range; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
];

export default function EditorialView({ overview }: { overview: ReportsOverview }) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const [range, setRange] = useState<Range>("1m");
  const { data, loading } = useDailyRevenue(range);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <PreviewBar letter="A" name="Editorial" letters={VARIANT_LIST} />

      <div className="max-w-5xl mx-auto px-8 py-16">
        {/* Masthead */}
        <header className="mb-14 border-b border-stone-300 pb-10">
          <p
            className="text-[11px] uppercase tracking-[0.22em] font-bold mb-3"
            style={{ color: ACCENT }}
          >
            Reports · {monthLabel}
          </p>
          <h1 className="font-serif text-6xl sm:text-7xl tracking-tight leading-[1.05] text-stone-950">
            The month
            <br /> in numbers.
          </h1>
        </header>

        {/* Hero chart */}
        <section className="mb-16">
          <div className="flex items-end justify-between gap-6 mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500 font-bold mb-1">
                {data?.label ?? "Revenue"}
              </p>
              <h2 className="font-serif text-5xl sm:text-6xl tracking-tight tabular-nums">
                {data ? money(data.total_cents, 0) : "—"}
              </h2>
            </div>
            <div className="flex items-center gap-1 bg-stone-200/70 rounded-full p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={
                    "px-3 py-1.5 rounded-full font-bold text-[11px] tracking-wide transition " +
                    (range === r.key
                      ? "bg-white text-stone-950 shadow-sm"
                      : "text-stone-500 hover:text-stone-950")
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {loading && !data ? (
            <div className="h-[360px] animate-pulse bg-stone-200/60 rounded-md" />
          ) : (
            <BigArea days={data?.days ?? []} />
          )}
        </section>

        <SerifSection title="Revenue">
          <SerifGrid>
            <SerifStat label="Total Revenue" value={money(overview.revenue.total_cents)} />
            <SerifStat label="Collected" value={money(overview.revenue.collected_cents)} />
            <SerifStat label="Unpaid" value={money(overview.revenue.unpaid_cents)} />
            <SerifStat label="Collection Rate" value={pct(overview.revenue.collection_rate)} />
          </SerifGrid>
        </SerifSection>

        <SerifSection title="Jobs">
          <SerifGrid>
            <SerifStat label="Total Jobs" value={String(overview.jobs.total)} />
            <SerifStat label="Completed" value={String(overview.jobs.completed)} />
            <SerifStat label="Scheduled" value={String(overview.jobs.scheduled)} />
            <SerifStat label="Canceled" value={String(overview.jobs.cancelled)} />
            <SerifStat label="Avg Job Value" value={money(overview.jobs.avg_value_cents)} />
          </SerifGrid>
        </SerifSection>

        <SerifSection title="Customers" last>
          <SerifGrid>
            <SerifStat label="Total Customers" value={String(overview.customers.total)} />
            <SerifStat label="New Customers" value={String(overview.customers.new)} />
            <SerifStat label="Repeat Customers" value={String(overview.customers.repeat)} />
          </SerifGrid>
        </SerifSection>
      </div>
    </div>
  );
}

function SerifSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "mb-12"}>
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-[11px] uppercase tracking-[0.22em] font-bold text-stone-500">
          {title}
        </h3>
        <span className="h-px flex-1" style={{ background: `${ACCENT}55` }} />
      </div>
      {children}
    </section>
  );
}

function SerifGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-x-10 gap-y-8"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      {children}
    </div>
  );
}

function SerifStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-stone-500 mb-2">
        {label}
      </div>
      <div className="font-serif text-4xl tracking-tight tabular-nums text-stone-950">
        {value}
      </div>
    </div>
  );
}

function BigArea({ days }: { days: { date: string; cents: number }[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[360px] flex items-center justify-center text-sm text-stone-400 font-semibold">
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 360;
  const padL = 0;
  const padR = 0;
  const padT = 12;
  const padB = 28;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const x = (i: number) =>
    padL + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => baseY - (v / max) * innerH;

  // Smooth path (Catmull–Rom-ish via simple bezier)
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

  const everyN = Math.max(1, Math.ceil(days.length / 8));

  return (
    <div className="w-full h-[360px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ed-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1={0} y1={baseY} x2={w} y2={baseY} stroke="#a8a29e" strokeWidth="1" />
        <path d={area} fill="url(#ed-area)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {days.map((d, i) =>
          i % everyN === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={h - 6}
              textAnchor="middle"
              fontSize="11"
              fill="#78716c"
              fontFamily="ui-serif, Georgia, serif"
              fontStyle="italic"
            >
              {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
