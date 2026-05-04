"use client";

import { PULSE } from "./_pulse_theme";
import type { LiveJob, RevenuePoint } from "./concept-live/_data";

// ---------- Formatters ---------------------------------------------------

export function formatCents(c: number, decimals = 0) {
  return `$${(c / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatCentsShort(c: number) {
  if (c >= 100_000_000) return `$${(c / 100_000_000).toFixed(1)}M`;
  if (c >= 100_000) return `$${(c / 100_000).toFixed(1)}K`;
  return `$${(c / 100).toFixed(0)}`;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const m = d.getMinutes().toString().padStart(2, "0");
  return { time: `${h12}:${m}`, ampm };
}

export function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function dateLabel(format: "short" | "long" = "long") {
  return new Date().toLocaleDateString(undefined, {
    weekday: format === "long" ? "long" : "short",
    month: format === "long" ? "long" : "short",
    day: "numeric",
  });
}

// ---------- KPI card with delta chip -------------------------------------

export function BoldKpi({
  label,
  value,
  delta,
  deltaPositive,
  size = "default",
  sparklineDays,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  size?: "default" | "large" | "compact";
  sparklineDays?: RevenuePoint[];
}) {
  const padding = size === "large" ? "p-7" : size === "compact" ? "p-4" : "p-5";
  const valueSize =
    size === "large" ? "text-[44px]" : size === "compact" ? "text-[24px]" : "text-[34px]";
  const labelSize = size === "compact" ? "text-[11px]" : "text-[11.5px]";

  return (
    <div
      className={`rounded-2xl ${padding} relative`}
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`${labelSize} font-bold`} style={{ color: PULSE.textSubtle }}>
          {label}
        </div>
        {delta && (
          <span
            className="text-[10.5px] px-2 py-0.5 rounded-md font-bold tabular-nums"
            style={{
              background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
              color: deltaPositive ? PULSE.green : PULSE.red,
            }}
          >
            {delta}
          </span>
        )}
      </div>
      <div className={`${valueSize} font-bold tracking-tight tabular-nums leading-none mt-1`}>
        {value}
      </div>
      {sparklineDays ? (
        <div className="mt-3 h-9">
          <BoldSparkline days={sparklineDays} />
        </div>
      ) : (
        <div className="text-[11px] mt-2 font-semibold" style={{ color: PULSE.textDim }}>
          vs last week
        </div>
      )}
    </div>
  );
}

// ---------- Status chip --------------------------------------------------

export function BoldStatusChip({ status }: { status: string }) {
  const onTheWay = status === "in_progress" || status === "on_the_way";
  if (onTheWay) {
    return (
      <span
        className="text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
        style={{ background: PULSE.text, color: PULSE.bg }}
      >
        On the way
      </span>
    );
  }
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap"
      style={{
        background: PULSE.bgAlt,
        color: PULSE.textMuted,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------- Schedule row -------------------------------------------------

export function BoldScheduleRow({
  job,
  showTech = true,
}: {
  job: LiveJob;
  showTech?: boolean;
}) {
  const { time, ampm } = formatTime(job.scheduled_at);
  return (
    <div
      className="flex items-center gap-4 px-3 py-3 rounded-xl"
      style={{
        background: PULSE.bgAlt,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div className="text-center w-12">
        <div className="text-[18px] font-bold tabular-nums leading-none">{time}</div>
        <div
          className="text-[10px] font-bold mt-1 tracking-[0.18em]"
          style={{ color: PULSE.textDim }}
        >
          {ampm}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold truncate">{job.customer_name}</div>
        {job.customer_address && (
          <div
            className="text-[12px] truncate font-semibold"
            style={{ color: PULSE.textSubtle }}
          >
            {job.customer_address}
          </div>
        )}
      </div>
      <BoldStatusChip status={job.status} />
      {showTech && job.technician_name && (
        <div
          className="text-[12px] font-semibold w-24 truncate text-right hidden xl:block"
          style={{ color: PULSE.textMuted }}
        >
          {job.technician_name}
        </div>
      )}
      <div
        className="text-[14px] font-bold tabular-nums w-20 text-right"
        style={{ color: PULSE.text }}
      >
        {formatCents(job.price_cents)}
      </div>
    </div>
  );
}

// ---------- Wavy line chart (white stroke) ------------------------------

export function BoldChart({
  days,
  height = 260,
  fillOpacity = 0.18,
}: {
  days: RevenuePoint[];
  height?: number;
  fillOpacity?: number;
}) {
  if (days.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[13px] font-bold"
        style={{ height, color: PULSE.textDim }}
      >
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = height;
  const padT = 8;
  const padB = 8;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const innerH = h - padT - padB;
  const baseY = padT + innerH;
  const x = (i: number) => (days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w);
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
  const id = `bold-area-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path
          d={path}
          fill="none"
          stroke={PULSE.text}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ---------- Sparkline (mini line for KPI cards) -------------------------

export function BoldSparkline({ days }: { days: RevenuePoint[] }) {
  if (days.length === 0) return null;
  const w = 200;
  const h = 36;
  const max = Math.max(...days.map((d) => d.cents), 1);
  const x = (i: number) => (days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w);
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
  const id = `bold-spark-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={path}
        fill="none"
        stroke={PULSE.text}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------- Donut --------------------------------------------------------

export function BoldDonut({
  value,
  size = 160,
  stroke = 14,
  color = PULSE.violet,
  colorEnd,
  centerLabel,
  centerSub,
  centerLabelClassName = "text-[28px] font-bold tracking-tight",
  centerSubClassName = "text-[10px] uppercase tracking-[0.2em] font-bold",
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  colorEnd?: string;
  centerLabel?: string;
  centerSub?: string;
  centerLabelClassName?: string;
  centerSubClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const dash = c * clamped;
  const id = `bold-donut-${Math.random().toString(36).slice(2, 7)}`;
  const useGradient = !!colorEnd;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {useGradient && (
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={colorEnd!} />
            </linearGradient>
          )}
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={PULSE.cardBorderHi}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={useGradient ? `url(#${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && (
            <div className={`tabular-nums leading-none ${centerLabelClassName}`}>
              {centerLabel}
            </div>
          )}
          {centerSub && (
            <div
              className={`mt-1.5 ${centerSubClassName}`}
              style={{ color: PULSE.textSubtle }}
            >
              {centerSub}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BoldSplitDonut({
  segments,
  size = 180,
  stroke = 16,
  centerLabel,
  centerSub,
  centerLabelClassName = "text-[28px] font-bold tracking-tight",
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerSub?: string;
  centerLabelClassName?: string;
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
            stroke={PULSE.cardBorderHi}
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
            <div
              className="text-[10px] uppercase tracking-[0.2em] font-bold mt-1.5"
              style={{ color: PULSE.textSubtle }}
            >
              {centerSub}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Pipeline row -------------------------------------------------

export type PipelineEntry = { label: string; count: number; value: number; pct: number };

export const SAMPLE_PIPELINE: PipelineEntry[] = [
  { label: "New leads", count: 12, value: 540_000, pct: 0.4 },
  { label: "Contacted", count: 8, value: 410_000, pct: 0.3 },
  { label: "Estimating", count: 9, value: 890_000, pct: 0.66 },
  { label: "Won", count: 6, value: 630_000, pct: 0.47 },
];

export function PipelineBars({ entries }: { entries: PipelineEntry[] }) {
  return (
    <div className="space-y-4">
      {entries.map((p) => (
        <div key={p.label}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[12.5px] font-bold">{p.label}</span>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: PULSE.textSubtle }}
            >
              {p.count} · {formatCentsShort(p.value)}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: PULSE.cardBorder }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${p.pct * 100}%`,
                background: `linear-gradient(90deg, ${PULSE.violet}, ${PULSE.violetSoft})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Activity feed -----------------------------------------------

export function ActivityFeed({ jobs }: { jobs: LiveJob[] }) {
  const items: { color: string; who: string; what: string; when: string }[] = [];
  if (jobs.length > 0) {
    items.push({
      color: PULSE.green,
      who: "System",
      what: `scheduled ${jobs[0].customer_name}`,
      when: formatTime(jobs[0].scheduled_at).time,
    });
  }
  if (jobs.length > 1) {
    items.push({
      color: PULSE.violet,
      who: "System",
      what: `noted ${jobs[1].customer_name}`,
      when: formatTime(jobs[1].scheduled_at).time,
    });
  }
  if (jobs.length > 2) {
    items.push({
      color: PULSE.cyan,
      who: "System",
      what: `assigned ${jobs[2].customer_name}`,
      when: formatTime(jobs[2].scheduled_at).time,
    });
  }
  if (items.length === 0) {
    return (
      <p
        className="py-8 text-center text-[12.5px] font-bold"
        style={{ color: PULSE.textSubtle }}
      >
        No recent activity.
      </p>
    );
  }
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-1 w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
            style={{
              background: `${it.color}1F`,
              color: it.color,
              border: `1px solid ${it.color}33`,
            }}
          >
            {it.who[0]}
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12.5px] font-semibold leading-snug"
              style={{ color: PULSE.textMuted }}
            >
              <span className="font-bold" style={{ color: PULSE.text }}>
                {it.who}
              </span>{" "}
              {it.what}
            </div>
            <div
              className="text-[10.5px] mt-0.5 font-bold uppercase tracking-[0.16em]"
              style={{ color: PULSE.textDim }}
            >
              {it.when}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LiveBadge() {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ color: PULSE.green }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: PULSE.green, boxShadow: `0 0 8px ${PULSE.green}` }}
      />
      Live
    </span>
  );
}
