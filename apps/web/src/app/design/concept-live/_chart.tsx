"use client";

import { useEffect, useRef, useState } from "react";
import { useTokens, ACCENT } from "./_theme";

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

function tooltipMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tooltipDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRangeLabel(start: string, end: string, range: Range) {
  const s = new Date(start);
  const e = new Date(end);
  if (range === "1y") return `${s.getFullYear()}`;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

// Monotone cubic interpolation (Fritsch–Carlson). Generates a smooth Bezier
// path that never overshoots, so for non-negative inputs the curve stays at
// or above the baseline.
function smoothPath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0][0]},${points[0][1]}`;
  if (n === 2) return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;
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
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
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

function ChartCanvas({
  days,
  strokeWidth = 2.5,
}: {
  days: Day[];
  strokeWidth?: number;
}) {
  const t = useTokens();
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

  const gridStroke = t.isDark ? "#3f3f46" : "#e5e7eb";
  const axisLabel = t.isDark ? "#71717a" : "#94a3b8";
  const tooltipCard = t.isDark
    ? "bg-zinc-900 border border-zinc-700 text-zinc-100"
    : "bg-white border border-zinc-200 text-zinc-900";
  const tooltipMuted = t.isDark ? "text-zinc-400" : "text-zinc-500";
  const dotStroke = t.isDark ? "#0a0a0a" : "#fff";
  const fillId = `revArea-${t.isDark ? "d" : "l"}`;

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
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
          <clipPath id="revPlot">
            <rect x={padLeft} y={padTop} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(tick)}
              y2={y(tick)}
              stroke={gridStroke}
              strokeDasharray="2 4"
            />
            <text
              x={padLeft - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              fill={axisLabel}
              fontSize="11"
            >
              {Math.round(tick / 100)}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill={`url(#${fillId})`} clipPath="url(#revPlot)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={ACCENT}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {lastPoint && hoverIdx === null && (
          <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill={ACCENT} stroke={dotStroke} strokeWidth="2" />
        )}

        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint[0]}
              x2={hoveredPoint[0]}
              y1={padTop}
              y2={baseY}
              stroke={axisLabel}
              strokeDasharray="2 4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={hoveredPoint[0]} cy={hoveredPoint[1]} r="5" fill={ACCENT} stroke={dotStroke} strokeWidth="2" />
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
              fill={axisLabel}
              fontSize="11"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {hovered && (
        <div
          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-full ${tooltipCard} rounded-lg shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap`}
          style={{ left: `${tooltipLeftPct}%`, top: 8 }}
        >
          <div className={tooltipMuted}>{tooltipDate(hovered.date)}</div>
          <div className="font-bold tabular-nums">{tooltipMoney(hovered.cents)}</div>
        </div>
      )}
    </div>
  );
}

export function SmoothRevenueChart({
  initialRange = "1m",
  totalSize = "text-4xl sm:text-5xl",
  strokeWidth = 2.5,
}: {
  initialRange?: Range;
  totalSize?: string;
  strokeWidth?: number;
}) {
  const t = useTokens();
  const [range, setRange] = useState<Range>(initialRange);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedLabel, setUpdatedLabel] = useState<string>("");

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

  const segBg = t.isDark ? "bg-zinc-800" : "bg-zinc-100";
  const segActive = t.isDark ? "bg-zinc-600 text-white" : "bg-white text-zinc-900";
  const segIdle = t.isDark
    ? "text-zinc-400 hover:text-white"
    : "text-zinc-500 hover:text-zinc-900";

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className={`text-[15px] font-bold ${t.text}`}>{data?.label ?? "Revenue"}</h3>
          <div className={`${totalSize} font-bold mt-2 tabular-nums ${t.text}`}>
            {data ? money(data.total_cents) : "—"}
          </div>
          <span className="inline-block mt-2 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
        </div>
        <div className={`flex items-center gap-1 ${segBg} rounded-full p-1 text-sm`}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={
                "px-3 py-1.5 rounded-full font-bold text-[12px] transition " +
                (range === r.key ? `${segActive} shadow-sm` : segIdle)
              }
            >
              {r.label}
            </button>
          ))}
          <div className={`px-3 py-1.5 text-[11px] whitespace-nowrap ${t.subtle} font-semibold`}>
            {data ? formatRangeLabel(data.start, data.end, data.range) : "—"}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className={`h-[280px] sm:h-[320px] animate-pulse ${t.isDark ? "bg-zinc-800" : "bg-zinc-50"} rounded-xl`} />
      ) : data && data.days.length > 0 ? (
        <ChartCanvas days={data.days} strokeWidth={strokeWidth} />
      ) : (
        <div className={`h-[280px] flex items-center justify-center text-sm ${t.subtle} font-semibold`}>
          No data yet.
        </div>
      )}

      <div className={`mt-2 text-right text-[11px] ${t.subtle} font-semibold`}>
        Avg: {data ? moneyDecimal(data.avg_cents) : "—"} · Updated{" "}
        <span suppressHydrationWarning>{updatedLabel || "—"}</span>
      </div>
    </div>
  );
}
