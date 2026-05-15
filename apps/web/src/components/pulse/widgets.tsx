"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PULSE } from "./theme";
import { PulseIcon } from "./Icon";
import { formatCents, formatCentsShort, formatTime } from "./format";
import type {
  LiveJob,
  PipelineEntry,
  RevenuePoint,
  RevenueSummary,
} from "./types";

// Re-export so existing client-side importers can keep getting types
// from this barrel. Server components must import formatters/types
// directly from ./format and ./types — re-exports of values from a
// "use client" module become client references in production builds
// and aren't callable on the server.
export type { LiveJob, PipelineEntry, RevenuePoint, RevenueSummary };

// ---------- Card header link --------------------------------------------

export function CardHeaderLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="text-[11.5px] font-extrabold"
      style={{ color: PULSE.violetVar }}
    >
      {label}
    </Link>
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

// ---------- Compact KPI card -------------------------------------------

export function CompactHeroKpi({
  label,
  value,
  delta,
  deltaPositive,
  subLabel = "vs last week",
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  subLabel?: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[14px] font-semibold text-zinc-500">
          {label}
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full font-extrabold whitespace-nowrap"
          style={{
            background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
            color: deltaPositive ? PULSE.green : PULSE.red,
          }}
        >
          {delta}
        </span>
      </div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      {subLabel && (
        <div className="mt-2 text-[14px] font-semibold text-zinc-400">
          {subLabel}
        </div>
      )}
    </div>
  );
}

// ---------- Hero chart (white-stroke wavy, interactive) ----------------
// Path + grid render inside an SVG with preserveAspectRatio="none" so they
// stretch to fill the container. Axis labels and the hover tooltip are
// HTML overlays positioned by percent so text never gets stretched. Hover
// shows a crosshair, dot, and tooltip with the date + dollar value of the
// nearest data point.

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

export function HeroChart({
  days,
  height = 300,
}: {
  days: RevenuePoint[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Stable across SSR + hydration so the gradient ref isn't broken on hydrate.
  const reactId = useId();
  const id = `hero-${reactId.replace(/:/g, "")}`;

  if (days.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[13px] font-extrabold"
        style={{ height, color: PULSE.textDim }}
      >
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = height;
  const padL = 44;
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
  const yTicks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];
  const everyN = Math.max(1, Math.ceil(days.length / 10));
  const padLPct = (padL / w) * 100;
  const padRPct = (padR / w) * 100;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const node = containerRef.current;
    if (!node || days.length === 0) return;
    const rect = node.getBoundingClientRect();
    // Plot area is between padL/w and (w-padR)/w of the container width.
    const plotLeft = (padL / w) * rect.width;
    const plotRight = ((w - padR) / w) * rect.width;
    const localX = e.clientX - rect.left;
    if (localX < plotLeft || localX > plotRight) {
      setHoverIdx(null);
      return;
    }
    const ratio = (localX - plotLeft) / (plotRight - plotLeft);
    let idx = Math.round(ratio * (days.length - 1));
    if (idx < 0) idx = 0;
    if (idx > days.length - 1) idx = days.length - 1;
    setHoverIdx(idx);
  }

  const hovered = hoverIdx !== null ? days[hoverIdx] : null;
  const hoverXPct = hoverIdx !== null ? (x(hoverIdx) / w) * 100 : 0;
  const hoverYPct = hovered ? (y(hovered.cents) / h) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-crosshair"
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        style={{ color: PULSE.violetVar }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, i) => {
          const yp = y(tick);
          return (
            <line
              key={i}
              x1={padL}
              x2={w - padR}
              y1={yp}
              y2={yp}
              stroke={PULSE.cardBorder}
              strokeDasharray="2 4"
            />
          );
        })}
        <path d={area} fill={`url(#${id})`} />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hoverIdx !== null && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={padT}
            y2={baseY}
            stroke={PULSE.textDim}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="absolute inset-0 pointer-events-none">
        {yTicks.map((tick, i) => {
          const yPct = (y(tick) / h) * 100;
          return (
            <div
              key={i}
              className="absolute text-[11px] font-extrabold"
              style={{
                left: 0,
                width: `${padLPct}%`,
                top: `${yPct}%`,
                transform: "translateY(-50%)",
                textAlign: "right",
                paddingRight: 8,
                color: PULSE.textDim,
              }}
            >
              ${Math.round(tick / 100)}
            </div>
          );
        })}
        {days.map((d, i) =>
          i % everyN === 0 || i === days.length - 1 ? (
            <div
              key={d.date}
              className="absolute text-[11px] font-extrabold"
              style={{
                left: `${(x(i) / w) * 100}%`,
                bottom: 4,
                transform: "translateX(-50%)",
                color: PULSE.textDim,
              }}
            >
              {new Date(`${d.date}T12:00:00`).getDate()}
            </div>
          ) : null
        )}
        <div
          className="absolute"
          style={{ right: 0, top: 0, width: `${padRPct}%`, height: "100%" }}
        />
        {/* Hover dot — sits exactly on the path, tinted with the accent. */}
        {hovered && (
          <div
            className="absolute rounded-full"
            style={{
              left: `${hoverXPct}%`,
              top: `${hoverYPct}%`,
              transform: "translate(-50%, -50%)",
              width: 12,
              height: 12,
              background: PULSE.violetVar,
              boxShadow: `0 0 0 3px ${PULSE.bg}`,
            }}
          />
        )}
        {/* Hover tooltip — date + dollar value, follows the dot horizontally */}
        {hovered && (
          <div
            className="absolute rounded-lg px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-tooltip"
            style={{
              left: `${hoverXPct}%`,
              top: 0,
              transform: "translate(-50%, -8px)",
              marginTop: -36,
              background: PULSE.card,
              border: `1px solid ${PULSE.cardBorderHi}`,
              color: PULSE.text,
            }}
          >
            <div
              className="text-xs font-bold"
              style={{ color: PULSE.textSubtle }}
            >
              {tooltipDate(hovered.date)}
            </div>
            <div className="font-black tracking-tight tabular-nums mt-0.5">
              {tooltipMoney(hovered.cents)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Chart hero card (with embedded headline + range pills) ------
// Fetches its own data from /api/revenue for the selected range so the
// toggle (7D / 1M / 3M) actually works and the headline + path update
// when the range changes. The HeroChart inside handles hover tooltips.

type ChartRange = "1w" | "1m" | "3m" | "ytd" | "custom";

const CHART_RANGES: { key: ChartRange; label: string; title: string }[] = [
  { key: "1w", label: "1W", title: "Last 7 Days" },
  { key: "1m", label: "1M", title: "This Month" },
  { key: "3m", label: "3M", title: "Last 3 Months" },
  { key: "ytd", label: "YTD", title: "Year To Date" },
  { key: "custom", label: "Custom", title: "Custom Range" },
];

type ApiRevenue = {
  range: ChartRange | "1y";
  label: string;
  start: string;
  end: string;
  days: RevenuePoint[];
  total_cents: number;
  avg_cents: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function PulseChartHero({
  initialRange = "1m",
  height = 300,
}: {
  initialRange?: ChartRange;
  height?: number;
} = {}) {
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [customStart, setCustomStart] = useState<string>(thirtyDaysAgoIso());
  const [customEnd, setCustomEnd] = useState<string>(todayIso());
  const [data, setData] = useState<ApiRevenue | null>(null);
  const [loading, setLoading] = useState(true);

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
      .then((d: ApiRevenue) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, customStart, customEnd]);

  const titleLabel =
    CHART_RANGES.find((r) => r.key === range)?.title ?? data?.label ?? "Revenue";
  const total = data ? data.total_cents : 0;

  return (
    <section
      className="rounded-2xl p-7"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[14px] font-semibold mb-3 text-zinc-500">
            Revenue · {titleLabel}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[52px] font-black tracking-tight leading-none">
              {data ? formatCentsShort(total) : "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className="flex items-center gap-1 p-1 rounded-full"
            style={{ background: PULSE.bgAlt }}
          >
            {CHART_RANGES.map((r) => {
              const active = r.key === range;
              return (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className="px-3.5 py-1 rounded-full text-[11.5px] font-extrabold transition-colors"
                  style={{
                    background: active ? PULSE.text : "transparent",
                    color: active ? PULSE.bg : PULSE.textMuted,
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 w-36 rounded-md px-2 text-sm"
                style={{
                  background: PULSE.bgAlt,
                  border: `1px solid ${PULSE.cardBorder}`,
                  color: PULSE.text,
                }}
              />
              <span style={{ color: PULSE.textMuted }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 w-36 rounded-md px-2 text-sm"
                style={{
                  background: PULSE.bgAlt,
                  border: `1px solid ${PULSE.cardBorder}`,
                  color: PULSE.text,
                }}
              />
            </div>
          )}
        </div>
      </div>
      {loading && !data ? (
        <div
          className="rounded-xl animate-pulse"
          style={{ height, background: PULSE.bgAlt }}
        />
      ) : (
        <HeroChart days={data?.days ?? []} height={height} />
      )}
    </section>
  );
}

// ---------- Schedule row + card -----------------------------------------

export function PulseScheduleRow({
  job,
  showTech = false,
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
        <div className="text-[18px] font-bold leading-none">{time}</div>
        <div
          className="text-[10px] font-bold mt-1"
          style={{ color: PULSE.textDim }}
        >
          {ampm}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold truncate">{job.customer_name}</div>
        {job.customer_address && (
          <div
            className="text-[12px] truncate font-bold"
            style={{ color: PULSE.textSubtle }}
          >
            {job.customer_address}
          </div>
        )}
      </div>
      <PulseStatusChip status={job.status} />
      {showTech && job.technician_name && (
        <div
          className="text-[12px] font-bold w-24 truncate text-right hidden xl:block"
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

export function PulseStatusChip({ status }: { status: string }) {
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

export function PulseScheduleCard({
  jobs,
  rows = 5,
}: {
  jobs: LiveJob[];
  rows?: number;
}) {
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">
          Today's Schedule
        </h2>
        <CardHeaderLink label="View all →" href="/schedule" />
      </div>
      {jobs.length === 0 ? (
        <PulseEmptyState
          iconName="calendar"
          title="Nothing on the calendar"
          sub="Today's jobs will appear here once scheduled."
        />
      ) : (
        <div className="space-y-2">
          {jobs.slice(0, rows).map((j) => (
            <PulseScheduleRow key={j.id} job={j} showTech={false} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Pipeline ----------------------------------------------------
// Pipeline numbers are placeholder for now — real lead/estimate counts can
// be wired in when the pipeline aggregator is ready.

export const PLACEHOLDER_PIPELINE: PipelineEntry[] = [
  { label: "New Leads", count: 12, value: 540_000, pct: 0.4 },
  { label: "Contacted", count: 8, value: 410_000, pct: 0.3 },
  { label: "Estimating", count: 9, value: 890_000, pct: 0.66 },
  { label: "Won", count: 6, value: 630_000, pct: 0.47 },
];

export function PulsePipelineCard({
  entries = PLACEHOLDER_PIPELINE,
}: {
  entries?: PipelineEntry[];
}) {
  const totalCount = entries.reduce((s, e) => s + e.count, 0);
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">Pipeline</h2>
        <p className="text-[12px] mt-1 font-bold" style={{ color: PULSE.textSubtle }}>
          {totalCount} active
        </p>
      </div>
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
                  background: `linear-gradient(90deg, ${PULSE.violetVar}, ${PULSE.violetSoftVar})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Empty state -------------------------------------------------

export function PulseEmptyState({
  iconName,
  title,
  sub,
}: {
  iconName: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: PULSE.bgAlt,
          color: PULSE.textSubtle,
          border: `1px solid ${PULSE.cardBorder}`,
        }}
      >
        <PulseIcon name={iconName} />
      </div>
      <p className="mt-3 text-sm font-extrabold">{title}</p>
      <p
        className="text-[11.5px] mt-1 font-bold max-w-[20ch]"
        style={{ color: PULSE.textSubtle }}
      >
        {sub}
      </p>
    </div>
  );
}

// ---------- Inbox / Tasks / Activity cards ------------------------------

export function PulseInboxCard() {
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">Inbox</h2>
        <span
          className="text-xs font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          0 unread
        </span>
      </div>
      <PulseEmptyState
        iconName="message"
        title="No recent conversations"
        sub="New conversations will appear here."
      />
    </section>
  );
}

export function PulseTasksCard() {
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">Tasks</h2>
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center shadow-glow-violet-sm"
          style={{
            background: PULSE.violetVar,
            color: PULSE.violetFgVar,
          }}
        >
          <PulseIcon name="plus" className="w-3.5 h-3.5" />
        </button>
      </div>
      <PulseEmptyState
        iconName="doc"
        title="No tasks yet"
        sub="Create one to keep your team organized."
      />
    </section>
  );
}

export function LiveBadge() {
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-bold"
      style={{ color: PULSE.green }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shadow-glow-green"
        style={{ background: PULSE.green }}
      />
      Live
    </span>
  );
}

export function PulseActivityCard({ jobs }: { jobs: LiveJob[] }) {
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
      color: PULSE.violetVar,
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
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">Activity</h2>
        <LiveBadge />
      </div>
      {items.length === 0 ? (
        <p
          className="py-8 text-center text-[12.5px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          No recent activity.
        </p>
      ) : (
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
                  className="text-[12.5px] font-bold leading-snug"
                  style={{ color: PULSE.textMuted }}
                >
                  <span className="font-bold" style={{ color: PULSE.text }}>
                    {it.who}
                  </span>{" "}
                  {it.what}
                </div>
                <div
                  className="text-xs mt-0.5 font-bold"
                  style={{ color: PULSE.textDim }}
                >
                  {it.when}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
