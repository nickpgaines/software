"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Range = "1w" | "1m" | "3m" | "ytd" | "custom";

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
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

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
  if (range === "ytd") return `${s.getFullYear()} YTD`;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

// Monotone cubic interpolation (Fritsch–Carlson). Generates a smooth
// Bezier path that NEVER overshoots or undershoots the data points,
// so for non-negative inputs the curve stays at or above the baseline.
function smoothPath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0][0]},${points[0][1]}`;
  if (n === 2) {
    return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;
  }
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dxi = points[i + 1][0] - points[i][0];
    dx.push(dxi);
    slope.push(dxi === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dxi);
  }
  const tangent: number[] = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const m1 = slope[i - 1];
    const m2 = slope[i];
    if (m1 * m2 <= 0) {
      tangent[i] = 0;
    } else {
      const dx1 = dx[i - 1];
      const dx2 = dx[i];
      const common = dx1 + dx2;
      tangent[i] = (3 * common) / ((common + dx2) / m1 + (common + dx1) / m2);
    }
  }
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = points[i][0];
    const y0 = points[i][1];
    const x1 = points[i + 1][0];
    const y1 = points[i + 1][1];
    const h = (x1 - x0) / 3;
    const c1x = x0 + h;
    const c1y = y0 + tangent[i] * h;
    const c2x = x1 - h;
    const c2y = y1 - tangent[i + 1] * h;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(
      2
    )},${c2y.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

// Picks the smallest "nice" chart-top >= value so 5 ticks (0, 25%, 50%, 75%, 100%)
// cover the data tightly. Uses steps from {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10} × 10^n
// so e.g. 1098 → 1200 and 5425 → 6000 instead of jumping to 2000 / 10000.
function niceCeil(value: number) {
  if (value <= 0) return 1;
  const intervals = 4;
  const rawStep = value / intervals;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceMultipliers = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let chosen = 10;
  for (const m of niceMultipliers) {
    if (m >= norm) {
      chosen = m;
      break;
    }
  }
  return chosen * mag * intervals;
}

function tooltipMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tooltipDate(iso: string) {
  // Force midday so the date doesn't shift across timezones.
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const baseY = padTop + innerH;

  const x = (i: number) =>
    padLeft + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => baseY - (v / yMax) * innerH;

  const points = days.map((d, i) => [x(i), y(d.cents)] as [number, number]);
  const linePath = smoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1][0]},${baseY} L ${points[0][0]},${baseY} Z`
      : "";

  const lastIdx = days.length - 1;
  const lastPoint = points[lastIdx];

  const xLabelEvery = Math.max(1, Math.ceil(days.length / 20));

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const node = containerRef.current;
    if (!node || days.length === 0) return;
    const rect = node.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    // Map container X back into the SVG's viewBox space.
    const vbX = (localX / rect.width) * width;
    if (days.length === 1) {
      setHoverIdx(0);
      return;
    }
    const stepVB = innerW / (days.length - 1);
    const rel = (vbX - padLeft) / stepVB;
    let idx = Math.round(rel);
    if (idx < 0) idx = 0;
    if (idx > days.length - 1) idx = days.length - 1;
    setHoverIdx(idx);
  }

  const hovered = hoverIdx !== null ? days[hoverIdx] : null;
  const hoveredPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const tooltipLeftPct = hoveredPoint ? (hoveredPoint[0] / width) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[280px] sm:h-[320px]"
      onMouseMove={onMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <clipPath id="revPlot">
            {/* Clip the area fill to the plot rectangle, so even if a
                future curve type ever dipped below baseY it can't bleed
                visibly past it. */}
            <rect x={padLeft} y={padTop} width={innerW} height={innerH} />
          </clipPath>
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

        {areaPath && (
          <path d={areaPath} fill="url(#revArea)" clipPath="url(#revPlot)" />
        )}
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

        {lastPoint && hoverIdx === null && (
          <circle
            cx={lastPoint[0]}
            cy={lastPoint[1]}
            r="4"
            fill="#38bdf8"
            stroke="#fff"
            strokeWidth="2"
          />
        )}

        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint[0]}
              x2={hoveredPoint[0]}
              y1={padTop}
              y2={baseY}
              stroke="#94a3b8"
              strokeDasharray="2 4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoveredPoint[0]}
              cy={hoveredPoint[1]}
              r="5"
              fill="#38bdf8"
              stroke="#fff"
              strokeWidth="2"
            />
          </>
        )}

        {days.map((d, i) => {
          if (i % xLabelEvery !== 0 && i !== days.length - 1) return null;
          const date = new Date(`${d.date}T12:00:00`);
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

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-card border border-line rounded-lg shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{ left: `${tooltipLeftPct}%`, top: 8 }}
        >
          <div className="text-zinc-400">{tooltipDate(hovered.date)}</div>
          <div className="font-extrabold text-white tracking-tight tabular-nums">
            {tooltipMoney(hovered.cents)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RevenueChart() {
  const [range, setRange] = useState<Range>("1m");
  const [customStart, setCustomStart] = useState<string>(thirtyDaysAgoIso());
  const [customEnd, setCustomEnd] = useState<string>(todayIso());
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedLabel, setUpdatedLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      params.set("start", customStart);
      params.set("end", customEnd);
    }
    fetch(`/api/revenue?${params.toString()}`)
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
  }, [range, customStart, customEnd]);

  useEffect(() => {
    setUpdatedLabel(
      new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  }, [data]);

  return (
    <div className="bg-card border border-line rounded-2xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            {data?.label ?? "Revenue"}
          </h2>
          <div className="text-4xl sm:text-5xl font-bold text-white mt-2 tabular-nums">
            {data ? money(data.total_cents) : "—"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 max-w-full">
          <div className="overflow-x-auto scrollbar-none max-w-full">
          <div className="inline-flex items-center gap-1 bg-black rounded-full p-1 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  "whitespace-nowrap px-3 py-1.5 rounded-full transition " +
                  (range === r.key
                    ? "bg-card text-white shadow-sm"
                    : "text-zinc-400 hover:text-white")
                }
              >
                {r.label}
              </button>
            ))}
            <div className="px-3 py-1.5 text-zinc-400 text-xs whitespace-nowrap">
              {data ? formatRangeLabel(data.start, data.end, data.range) : "—"}
            </div>
          </div>
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 w-36 rounded-md border border-line bg-card px-2 text-sm text-white"
              />
              <span className="text-zinc-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 w-36 rounded-md border border-line bg-card px-2 text-sm text-white"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {loading && !data ? (
          <div className="h-[280px] sm:h-[320px] animate-pulse bg-black rounded-xl" />
        ) : data && data.days.length > 0 ? (
          <Chart days={data.days} />
        ) : (
          <div className="h-[280px] flex items-center justify-center text-zinc-500 text-sm">
            No data yet.
          </div>
        )}
      </div>

      <div className="mt-2 text-right text-xs text-zinc-400">
        Avg: {data ? moneyDecimal(data.avg_cents) : "—"} · Updated{" "}
        <span suppressHydrationWarning>{updatedLabel || "—"}</span>
      </div>
    </div>
  );
}
