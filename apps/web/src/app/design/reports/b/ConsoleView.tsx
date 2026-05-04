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

export default function ConsoleView({ overview }: { overview: ReportsOverview }) {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const [range, setRange] = useState<Range>("1m");
  const { data, loading } = useDailyRevenue(range);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 font-mono">
      <PreviewBar letter="B" name="Console" letters={VARIANT_LIST} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-2 font-sans">
              REPORTS / OVERVIEW
            </p>
            <h1 className="text-3xl font-bold tracking-tight font-sans">
              {monthLabel}
            </h1>
          </div>
          <div className="flex items-center gap-0 border border-zinc-300 rounded-md overflow-hidden">
            {RANGES.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  "px-3 py-1.5 text-[11px] font-bold tracking-wide transition " +
                  (i > 0 ? "border-l border-zinc-300 " : "") +
                  (range === r.key
                    ? "bg-zinc-950 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-100")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {/* Bar chart */}
        <section className="mb-10 border border-zinc-300 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-300 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold font-sans">
                {data?.label ?? "Revenue"}
              </span>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: ACCENT }}
              />
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {data ? money(data.total_cents, 2) : "—"}
            </div>
          </div>
          <div className="p-4">
            {loading && !data ? (
              <div className="h-[260px] animate-pulse bg-zinc-100" />
            ) : (
              <BarChart days={data?.days ?? []} />
            )}
          </div>
        </section>

        {/* Two-column dense KPI grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
          <ConsoleSection
            title="REVENUE"
            rows={[
              ["Total Revenue", money(overview.revenue.total_cents)],
              ["Collected", money(overview.revenue.collected_cents)],
              ["Unpaid", money(overview.revenue.unpaid_cents)],
              ["Collection Rate", pct(overview.revenue.collection_rate)],
            ]}
          />
          <ConsoleSection
            title="JOBS"
            rows={[
              ["Total Jobs", String(overview.jobs.total)],
              ["Completed", String(overview.jobs.completed)],
              ["Scheduled", String(overview.jobs.scheduled)],
              ["Canceled", String(overview.jobs.cancelled)],
              ["Avg Job Value", money(overview.jobs.avg_value_cents)],
            ]}
          />
          <ConsoleSection
            title="CUSTOMERS"
            rows={[
              ["Total Customers", String(overview.customers.total)],
              ["New Customers", String(overview.customers.new)],
              ["Repeat Customers", String(overview.customers.repeat)],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ConsoleSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] font-bold text-zinc-500 font-sans">
          {title}
        </h3>
        <span className="h-px flex-1" style={{ background: `${ACCENT}55` }} />
      </div>
      <div className="border border-zinc-300 bg-white">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={
              "flex items-baseline justify-between px-4 py-3 " +
              (i > 0 ? "border-t border-zinc-200" : "")
            }
          >
            <span className="text-[12px] text-zinc-600 font-sans font-semibold">
              {label}
            </span>
            <span className="text-[16px] font-bold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BarChart({ days }: { days: { date: string; cents: number }[] }) {
  if (days.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-zinc-400 font-sans">
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 260;
  const padL = 40;
  const padR = 8;
  const padT = 8;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const niceMax = niceCeil(max);
  const ticks = [0, niceMax / 2, niceMax];
  const barW = innerW / days.length;
  const everyN = Math.max(1, Math.ceil(days.length / 12));
  return (
    <div className="w-full h-[260px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        {ticks.map((tick, i) => {
          const yp = baseY - (tick / niceMax) * innerH;
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={w - padR}
                y1={yp}
                y2={yp}
                stroke="#d4d4d8"
                strokeDasharray="2 4"
              />
              <text
                x={padL - 6}
                y={yp + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill="#71717a"
              >
                {Math.round(tick / 100)}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const barH = (d.cents / niceMax) * innerH;
          const xp = padL + i * barW;
          return (
            <rect
              key={d.date}
              x={xp + 1}
              y={baseY - barH}
              width={Math.max(1, barW - 2)}
              height={barH}
              fill={ACCENT}
              opacity={0.85}
            />
          );
        })}
        {days.map((d, i) =>
          i % everyN === 0 || i === days.length - 1 ? (
            <text
              key={`l-${d.date}`}
              x={padL + i * barW + barW / 2}
              y={h - 12}
              textAnchor="middle"
              fontSize="10"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="#71717a"
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
