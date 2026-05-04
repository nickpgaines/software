"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type Day = { date: string; cents: number };
export type RevenueData = {
  range: "1w" | "1m" | "3m" | "1y";
  label: string;
  start: string;
  end: string;
  days: Day[];
  total_cents: number;
  avg_cents: number;
};

export const ACCENT = "#379CFB";
export const ACCENT_SOFT = "#a3c8ff";
export const TRACK = "#e4e4e7";

export function money(cents: number, decimals = 2) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function moneyShort(cents: number) {
  if (cents >= 100_000_000) return `$${(cents / 100_000_000).toFixed(1)}M`;
  if (cents >= 100_000) return `$${(cents / 100_000).toFixed(1)}K`;
  return `$${(cents / 100).toFixed(0)}`;
}

export function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function useDailyRevenue(range: "1w" | "1m" | "3m" | "1y" = "1m") {
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
  return { data, loading };
}

export function PreviewBar({
  letter,
  name,
  letters,
}: {
  letter: string;
  name: string;
  letters: { key: string; label: string }[];
}) {
  return (
    <div className="h-11 bg-white border-b border-zinc-200 flex items-center justify-between px-4 text-[12px] sticky top-0 z-50">
      <Link href="/design" className="text-zinc-500 hover:text-zinc-950 font-bold">
        ← All concepts
      </Link>
      <div className="font-bold tracking-tight text-zinc-950">
        Reports {letter} · <span style={{ color: ACCENT }}>{name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
        {letters.map((l, i) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <Link href={`/design/reports/${l.key}`} className="hover:text-zinc-950">
              {l.label}
            </Link>
            {i < letters.length - 1 && <span>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export const VARIANT_LIST: { key: string; label: string }[] = [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C" },
  { key: "d", label: "D" },
];

// ---------- Range pills (matches the rest of the app) ---------------------

export type Range = "1w" | "1m" | "3m" | "1y";
export const RANGES: { key: Range; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
];

export function RangePills({
  range,
  setRange,
}: {
  range: Range;
  setRange: (r: Range) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-full p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={
            "px-3 py-1.5 rounded-full text-[12px] font-bold transition tracking-tight " +
            (range === r.key
              ? "bg-white text-zinc-950 shadow-sm"
              : "text-zinc-500 hover:text-zinc-900")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Donut ---------------------------------------------------------

export function Donut({
  value,
  label,
  size = 160,
  stroke = 16,
  color = ACCENT,
  track = TRACK,
  labelClassName = "text-[28px] font-extrabold tracking-tight",
}: {
  value: number;
  label?: string;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  labelClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const dash = c * clamped;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`tabular-nums ${labelClassName}`}>{label}</span>
        </div>
      )}
    </div>
  );
}

export function SplitDonut({
  segments,
  size = 180,
  stroke = 18,
  centerLabel,
  centerSub,
  centerLabelClassName = "text-[28px] font-extrabold tracking-tight",
  centerSubClassName = "text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-bold",
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerSub?: string;
  centerLabelClassName?: string;
  centerSubClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const empty = total === 0;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {empty ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TRACK}
            strokeWidth={stroke}
          />
        ) : (
          segments.map((seg, i) => {
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
          })
        )}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && (
            <div className={`tabular-nums leading-none ${centerLabelClassName}`}>
              {centerLabel}
            </div>
          )}
          {centerSub && (
            <div className={`mt-1.5 ${centerSubClassName}`}>{centerSub}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-500">
          {label}
        </span>
      </div>
      <div className="text-[18px] font-extrabold tabular-nums mt-1 tracking-tight">
        {value}
      </div>
    </div>
  );
}

// ---------- Sparkline ------------------------------------------------------

export function Spark({ days }: { days: Day[] }) {
  if (days.length === 0) return <div className="w-full h-full bg-zinc-50 rounded" />;
  const w = 200;
  const h = 40;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const x = (i: number) =>
    days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 4) - 2;
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
      <path d={path} fill="none" stroke={ACCENT} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
