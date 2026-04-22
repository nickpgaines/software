"use client";

import { useEffect, useMemo, useState } from "react";

type Range = "1w" | "1m" | "3m" | "1y";

type Day = { date: string; cents: number };

type RevenueData = {
  range: Range;
  label: string;
  start: string;
  end: string;
  days: Day[];
  total_cents: number;
  avg_cents: number;
};

const RANGES: { key: Range; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function moneyDecimal(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
}

function formatRangeLabel(start: string, end: string, range: Range) {
  const s = new Date(start);
  const e = new Date(end);
  if (range === "1y") return `${s.getFullYear()}`;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(
      2
    )},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function niceCeil(value: number) {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const mag = Math.pow(10, exp);
  const norm = value / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function Chart({ days }: { days: Day[] }) {
  const width = 1000;
  const height = 320;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 36;

  const maxCents = Math.max(...days.map((d) => d.cents), 0);
  const yMax = niceCeil(maxCents || 100);
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const x = (i: number) =>
    padLeft + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / yMax) * innerH;

  const points = days.map((d, i) => [x(i), y(d.cents)] as [number, number]);
  const linePath = smoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1][0]},${
          padTop + innerH
        } L ${points[0][0]},${padTop + innerH} Z`
      : "";

  const lastIdx = days.length - 1;
  const lastPoint = points[lastIdx];

  const xLabelEvery = Math.max(1, Math.ceil(days.length / 20));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-[280px] sm:h-[320px]"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={y(t)}
            y2={y(t)}
            stroke="#e5e7eb"
            strokeDasharray="2 4"
          />
          <text
            x={padLeft - 8}
            y={y(t)}
            dy="0.32em"
            textAnchor="end"
            className="fill-slate-400"
            fontSize="11"
          >
            {Math.round(t / 100)}
          </text>
        </g>
      ))}

      {areaPath && <path d={areaPath} fill="url(#revArea)" />}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {lastPoint && (
        <>
          <circle
            cx={lastPoint[0]}
            cy={lastPoint[1]}
            r="4"
            fill="#38bdf8"
            stroke="#fff"
            strokeWidth="2"
          />
        </>
      )}

      {days.map((d, i) => {
        if (i % xLabelEvery !== 0 && i !== days.length - 1) return null;
        const date = new Date(d.date);
        const label = date.getDate().toString();
        return (
          <text
            key={d.date}
            x={x(i)}
            y={height - padBottom + 18}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize="11"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function RevenueChart() {
  const [range, setRange] = useState<Range>("1m");
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/revenue?range=${range}`)
      .then((r) => r.json())
      .then((d: RevenueData) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const updatedLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [data]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {data?.label ?? "Revenue"}
          </h2>
          <div className="text-4xl sm:text-5xl font-bold text-slate-900 mt-2 tabular-nums">
            {data ? money(data.total_cents) : "—"}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-sm">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={
                "px-3 py-1.5 rounded-full transition " +
                (range === r.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900")
              }
            >
              {r.label}
            </button>
          ))}
          <div className="px-3 py-1.5 text-slate-500 text-xs whitespace-nowrap">
            {data ? formatRangeLabel(data.start, data.end, data.range) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {loading && !data ? (
          <div className="h-[280px] sm:h-[320px] animate-pulse bg-slate-50 rounded-xl" />
        ) : data && data.days.length > 0 ? (
          <Chart days={data.days} />
        ) : (
          <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
            No data yet.
          </div>
        )}
      </div>

      <div className="mt-2 text-right text-xs text-slate-500">
        Avg: {data ? moneyDecimal(data.avg_cents) : "—"} · Updated {updatedLabel}
      </div>
    </div>
  );
}
