"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { PULSE } from "./theme";
import { PulseIcon } from "./Icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Picks the smallest "nice" chart-top >= v so 5 ticks (0, 25%, 50%, 75%, 100%)
// cover the data tightly. Uses steps from {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10} × 10^n
// so e.g. 1098 → 1200 and 5425 → 6000 instead of jumping to 2000 / 10000.
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const intervals = 4;
  const rawStep = v / intervals;
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
      <div className="mt-2.5 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
        {value}
      </div>
      {subLabel && (
        <div className="mt-2.5 text-[14px] font-semibold text-zinc-400">
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

// Compact dollar label for the chart's Y-axis ticks. `tick` is in cents.
// Abbreviates thousands as "K" ($12000 → "$12K", $1500 → "$1.5K") so the
// labels stay narrow enough to sit inside the left gutter without bleeding
// over the plot — the old `$12000` form overflowed the gutter on mobile.
function axisTick(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    const k = dollars / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return `$${Math.round(dollars)}`;
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
  // Track container width so the SVG viewBox can match it 1:1 (otherwise the
  // fixed 1000-wide viewBox gets squished horizontally on phones and peaks
  // look like exaggerated tall thin spikes).
  const [containerWidth, setContainerWidth] = useState(1000);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  // Stable across SSR + hydration so the gradient ref isn't broken on hydrate.
  const reactId = useId();
  const id = `hero-${reactId.replace(/:/g, "")}`;

  // Mobile: shorter chart so it doesn't dominate the dashboard.
  const h = isMobile ? 200 : height;

  if (days.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[13px] font-extrabold"
        style={{ height: h, color: PULSE.textDim }}
      >
        No data yet.
      </div>
    );
  }
  const w = Math.max(1, Math.round(containerWidth));
  const padL = isMobile ? 40 : 44;
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

  function idxFromClientX(clientX: number): number | null {
    const node = containerRef.current;
    if (!node || days.length === 0) return null;
    const rect = node.getBoundingClientRect();
    const plotLeft = (padL / w) * rect.width;
    const plotRight = ((w - padR) / w) * rect.width;
    const localX = clientX - rect.left;
    if (localX < plotLeft || localX > plotRight) return null;
    const ratio = (localX - plotLeft) / (plotRight - plotLeft);
    let idx = Math.round(ratio * (days.length - 1));
    if (idx < 0) idx = 0;
    if (idx > days.length - 1) idx = days.length - 1;
    return idx;
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    setHoverIdx(idxFromClientX(e.clientX));
  }

  // Touch: tap or drag to inspect a day. We deliberately don't clear on
  // touchend so the user can see the value after lifting their finger;
  // tapping anywhere outside the plot clears it.
  function onTouch(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (!t) return;
    setHoverIdx(idxFromClientX(t.clientX));
  }

  const hovered = hoverIdx !== null ? days[hoverIdx] : null;
  const hoverXPct = hoverIdx !== null ? (x(hoverIdx) / w) * 100 : 0;
  const hoverYPct = hovered ? (y(hovered.cents) / h) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-crosshair touch-none"
      style={{ height: h }}
      onMouseMove={onMove}
      onMouseLeave={() => setHoverIdx(null)}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
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
              className="absolute text-[10px] md:text-[11px] font-extrabold tabular-nums"
              style={{
                left: 0,
                width: `${padLPct}%`,
                top: `${yPct}%`,
                transform: "translateY(-50%)",
                textAlign: "right",
                paddingRight: 6,
                color: PULSE.textDim,
              }}
            >
              {axisTick(tick)}
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
              {d.xLabel ?? new Date(`${d.date}T12:00:00`).getDate()}
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
              {hovered.label ?? tooltipDate(hovered.date)}
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

type ChartRange =
  | "today"
  | "yesterday"
  | "1w"
  | "4w"
  | "1m"
  | "mtd"
  | "3m"
  | "12m"
  | "qtd"
  | "ytd"
  | "all"
  | "custom";

// Quick pills — the four common windows kept inline.
const PILL_RANGES: { key: ChartRange; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "ytd", label: "YTD" },
];

// The gear-dropdown menu (Whop-style) with the full range list; "Custom
// range…" sits at the bottom.
const MENU_RANGES: { key: ChartRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "1w", label: "Last 7 Days" },
  { key: "4w", label: "Last 4 Weeks" },
  { key: "3m", label: "Last 3 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "mtd", label: "Month to Date" },
  { key: "qtd", label: "Quarter to Date" },
  { key: "ytd", label: "Year to Date" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range…" },
];

// Headline label per range (rendered as "Revenue · <title>").
const RANGE_TITLE: Record<ChartRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "1w": "Last 7 Days",
  "4w": "Last 4 Weeks",
  "1m": "This Month",
  mtd: "Month to Date",
  "3m": "Last 3 Months",
  "12m": "Last 12 Months",
  qtd: "Quarter to Date",
  ytd: "Year to Date",
  all: "All Time",
  custom: "Custom Range",
};

// Compact label for the mobile trigger pill. The full names (e.g.
// "Custom range…", "Quarter to Date") overflow the small button and truncate,
// so the trigger shows these short codes instead.
const SHORT_LABEL: Record<ChartRange, string> = {
  today: "Today",
  yesterday: "Yest",
  "1w": "1W",
  "4w": "4W",
  "1m": "1M",
  mtd: "MTD",
  "3m": "3M",
  "12m": "12M",
  qtd: "QTD",
  ytd: "YTD",
  all: "All",
  custom: "Custom",
};

const PILL_KEYS = new Set<ChartRange>(PILL_RANGES.map((r) => r.key));

// On mobile the four quick ranges show first and everything else lives behind
// a "More ranges" submenu, so the phone menu isn't one long scrolling list.
// Filter out the pill keys here so a range never appears (or gets checked)
// twice — e.g. "1w" is both the "1W" pill and "Last 7 Days" in the full list.
const EXTENDED_RANGES: { key: ChartRange; label: string }[] = MENU_RANGES.filter(
  (m) => !PILL_KEYS.has(m.key)
);
const EXTENDED_KEYS = new Set<ChartRange>(EXTENDED_RANGES.map((r) => r.key));

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

/**
 * Pure presentation version of the revenue chart hero. Renders the card,
 * headline, range pills, and HeroChart from props — no fetching, no state.
 * Pass `onRangeChange` to make the pills interactive; omit it to render
 * them as inert (visible, highlighted current range, but clicks no-op).
 * Used by the live `PulseChartHero` (with handlers) and by the marketing
 * site (without handlers).
 */
export function RevenueHeroView({
  days,
  totalCents,
  label,
  range,
  prefix = "Revenue",
  height = 300,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  loading = false,
}: {
  days: RevenuePoint[];
  totalCents: number;
  label: string;
  range: ChartRange;
  prefix?: string;
  height?: number;
  onRangeChange?: (r: ChartRange) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (s: string) => void;
  onCustomEndChange?: (s: string) => void;
  loading?: boolean;
}) {
  // Mobile range menu: "More ranges" expands the extended list inline (in the
  // same downward menu) rather than a side submenu, which clipped off the left
  // edge on a narrow screen. Reset when the menu closes so it reopens compact.
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <section
      className="rounded-2xl p-4 md:p-7"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[14px] font-semibold mb-3 text-zinc-500">
            {prefix} · {label}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[36px] md:text-[52px] font-black tracking-tight leading-none">
              {days.length ? formatCentsShort(totalCents) : "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {/* Desktop keeps the quick-pill row inline for one-tap access; on
                mobile the row is replaced by the gear dropdown alone to hand
                the graph back its horizontal space. */}
            <div
              className="hidden md:flex items-center gap-1 p-1 rounded-full"
              style={{ background: PULSE.bgAlt }}
            >
              {PILL_RANGES.map((r) => {
                const active = r.key === range;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={
                      onRangeChange ? () => onRangeChange(r.key) : undefined
                    }
                    className="px-3.5 py-1 rounded-full text-[11.5px] font-extrabold transition-colors"
                    style={{
                      background: active ? PULSE.text : "transparent",
                      color: active ? PULSE.bg : PULSE.textMuted,
                      cursor: onRangeChange ? "pointer" : "default",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {onRangeChange && (
              <DropdownMenu
                onOpenChange={(o) => {
                  if (!o) setMoreOpen(false);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Date range"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[11.5px] font-extrabold transition-colors md:w-8 md:px-0"
                    style={{
                      background: PILL_KEYS.has(range)
                        ? PULSE.bgAlt
                        : PULSE.text,
                      color: PILL_KEYS.has(range) ? PULSE.textMuted : PULSE.bg,
                    }}
                  >
                    <span className="md:hidden whitespace-nowrap">
                      {SHORT_LABEL[range] ?? "Range"}
                    </span>
                    <Settings2 className="h-4 w-4 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 max-h-[70vh] overflow-y-auto"
                >
                  {/* Mobile: the four quick ranges up top; "More ranges"
                      expands the rest inline (same downward menu) so the phone
                      menu stays short but nothing opens off-screen. */}
                  {PILL_RANGES.map((r) => (
                    <DropdownMenuItem
                      key={r.key}
                      className="md:hidden"
                      onSelect={() => onRangeChange(r.key)}
                    >
                      <span className="w-4 inline-block">
                        {r.key === range ? "✓" : ""}
                      </span>
                      <span className="ml-1">{r.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    className="md:hidden"
                    onSelect={(e) => {
                      // Keep the menu open and toggle the extended list inline.
                      e.preventDefault();
                      setMoreOpen((v) => !v);
                    }}
                  >
                    <span className="w-4 inline-block">
                      {EXTENDED_KEYS.has(range) ? "✓" : ""}
                    </span>
                    <span className="ml-1 flex-1">More ranges</span>
                    <ChevronDown
                      className={
                        "h-4 w-4 shrink-0 transition-transform " +
                        (moreOpen ? "rotate-180" : "")
                      }
                    />
                  </DropdownMenuItem>
                  {moreOpen &&
                    EXTENDED_RANGES.map((m) => (
                      <DropdownMenuItem
                        key={m.key}
                        className="md:hidden"
                        onSelect={() => onRangeChange(m.key)}
                      >
                        <span className="w-4 inline-block">
                          {m.key === range ? "✓" : ""}
                        </span>
                        <span className="ml-1">{m.label}</span>
                      </DropdownMenuItem>
                    ))}
                  {/* Desktop: the pill row already exposes the quick four, so
                      the gear dropdown lists the full range set flat. */}
                  {MENU_RANGES.map((m) => (
                    <DropdownMenuItem
                      key={m.key}
                      className="hidden md:flex"
                      onSelect={() => onRangeChange(m.key)}
                    >
                      <span className="w-4 inline-block">
                        {m.key === range ? "✓" : ""}
                      </span>
                      <span className="ml-1">{m.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart ?? ""}
                onChange={
                  onCustomStartChange
                    ? (e) => onCustomStartChange(e.target.value)
                    : undefined
                }
                readOnly={!onCustomStartChange}
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
                value={customEnd ?? ""}
                onChange={
                  onCustomEndChange
                    ? (e) => onCustomEndChange(e.target.value)
                    : undefined
                }
                readOnly={!onCustomEndChange}
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
      {loading ? (
        <div
          className="rounded-xl animate-pulse"
          style={{ height, background: PULSE.bgAlt }}
        />
      ) : (
        <HeroChart days={days} height={height} />
      )}
    </section>
  );
}

export function PulseChartHero({
  initialRange = "1m",
  height = 300,
  salesStaffId = null,
  titleOverride,
}: {
  initialRange?: ChartRange;
  height?: number;
  salesStaffId?: number | null;
  titleOverride?: string;
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
    if (salesStaffId != null) {
      params.set("sales_staff_id", String(salesStaffId));
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
  }, [range, customStart, customEnd, salesStaffId]);

  const days = data?.days ?? [];
  const titleLabel =
    range === "1m"
      ? // Server-computed window label (e.g. "July 2026 Revenue"); avoids
        // recomputing from new Date(), which can disagree at a month boundary.
        // The header prepends the "Revenue" prefix, so strip the API label's
        // trailing " Revenue" to keep the "Revenue · July 2026" display.
        (data?.label ?? "").replace(/ Revenue$/, "") || "Revenue"
      : range === "custom"
        ? // Show the concrete date range in the headline; the axis carries the
          // per-point dates.
          data?.label ?? RANGE_TITLE.custom
        : // Every other range gets a fixed human title ("Last 7 Days",
          // "Year to Date", …) — 1W deliberately reads "Last 7 Days" rather
          // than a date range since the dates are already on the chart.
          RANGE_TITLE[range] ?? data?.label ?? "Revenue";

  return (
    <RevenueHeroView
      days={days}
      totalCents={data?.total_cents ?? 0}
      label={titleLabel}
      range={range}
      prefix={titleOverride ?? "Revenue"}
      height={height}
      onRangeChange={setRange}
      customStart={customStart}
      customEnd={customEnd}
      onCustomStartChange={setCustomStart}
      onCustomEndChange={setCustomEnd}
      loading={loading && !data}
    />
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
      className="flex items-center gap-3 px-3 py-3 rounded-xl"
      style={{
        background: PULSE.bgAlt,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div className="text-center w-12 shrink-0">
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
      {/* Status chip hides on the narrow mobile widget so name/address get the
          room to render in full; it returns at sm+ where the row is wider. */}
      <span className="hidden sm:inline-flex shrink-0">
        <PulseStatusChip status={job.status} />
      </span>
      {showTech && job.technician_name && (
        <div
          className="text-[12px] font-bold w-24 truncate text-right hidden xl:block shrink-0"
          style={{ color: PULSE.textMuted }}
        >
          {job.technician_name}
        </div>
      )}
      <div
        className="text-[14px] font-bold tabular-nums w-20 text-right shrink-0"
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

export function PulsePipelineCard({
  entries: initial,
}: {
  entries?: PipelineEntry[];
}) {
  const [entries, setEntries] = useState<PipelineEntry[] | null>(
    initial ?? null
  );
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch("/api/leads/pipeline")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: PipelineEntry[]) => {
        if (!cancelled) setEntries(Array.isArray(rows) ? rows : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const list = entries ?? [];
  const totalCount = list.reduce((s, e) => s + e.count, 0);
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight">Pipeline</h2>
          <p className="text-[12px] mt-1 font-bold" style={{ color: PULSE.textSubtle }}>
            {loading ? "…" : `${totalCount} active`}
          </p>
        </div>
        <CardHeaderLink label="View" href="/leads" />
      </div>
      {loading ? (
        <p
          className="py-6 text-center text-[12.5px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          Loading…
        </p>
      ) : list.length === 0 || totalCount === 0 ? (
        <p
          className="py-6 text-center text-[12.5px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          No leads in the pipeline yet.
        </p>
      ) : (
        <div className="space-y-4">
          {list.map((p) => (
            <div key={p.label}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[12.5px] font-bold">{p.label}</span>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: PULSE.textSubtle }}
                >
                  {p.count}
                  {p.value > 0 ? ` · ${formatCentsShort(p.value)}` : ""}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: PULSE.cardBorder }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(p.pct * 100, p.count > 0 ? 4 : 0)}%`,
                    background: `linear-gradient(90deg, ${PULSE.violetVar}, ${PULSE.violetSoftVar})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
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

type TaskRow = {
  id: number;
  title: string;
  start_at: string;
  assignee_name: string | null;
  is_team_task: number;
  status: "open" | "done";
  completed_at: string | null;
};

function formatTaskWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (target.getTime() === today.getTime()) return `Today, ${time}`;
  if (target.getTime() === tomorrow.getTime()) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

export function PulseTasksCard() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?status=open");
      if (res.ok) {
        const rows = (await res.json()) as TaskRow[];
        setTasks(rows);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggle(id: number, next: "open" | "done") {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await reload();
  }

  const visible = tasks.slice(0, 5);

  return (
    <>
      <section
        className="rounded-2xl p-6"
        style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[15px] font-extrabold tracking-tight">Tasks</h2>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            aria-label="Create task"
            className="w-7 h-7 rounded-full flex items-center justify-center shadow-glow-violet-sm"
            style={{
              background: PULSE.violetVar,
              color: PULSE.violetFgVar,
            }}
          >
            <PulseIcon name="plus" className="w-3.5 h-3.5" />
          </button>
        </div>
        {loading ? (
          <p
            className="py-8 text-center text-[12.5px] font-bold"
            style={{ color: PULSE.textSubtle }}
          >
            Loading…
          </p>
        ) : visible.length === 0 ? (
          <PulseEmptyState
            iconName="doc"
            title="No tasks yet"
            sub="Create one to keep your team organized."
          />
        ) : (
          <ul className="space-y-2.5">
            {visible.map((t) => (
              <li key={t.id} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(t.id, t.status === "open" ? "done" : "open")}
                  aria-label={t.status === "open" ? "Mark complete" : "Mark open"}
                  className="mt-0.5 w-4 h-4 rounded-[4px] border flex-shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: PULSE.cardBorder,
                    background:
                      t.status === "done" ? PULSE.violetVar : "transparent",
                  }}
                >
                  {t.status === "done" && (
                    <PulseIcon name="check" className="w-3 h-3" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12.5px] font-bold leading-snug truncate"
                    style={{
                      color: t.status === "done" ? PULSE.textDim : PULSE.text,
                      textDecoration:
                        t.status === "done" ? "line-through" : undefined,
                    }}
                  >
                    {t.title}
                  </div>
                  <div
                    className="text-xs mt-0.5 font-bold"
                    style={{ color: PULSE.textDim }}
                  >
                    {formatTaskWhen(t.start_at)}
                    {t.is_team_task
                      ? " · Team"
                      : t.assignee_name
                      ? ` · ${t.assignee_name}`
                      : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PulseCreateTaskModalLazy
        open={openModal}
        onOpenChange={setOpenModal}
        onCreated={reload}
      />
    </>
  );
}

// Lazy-loaded modal so the heavy form code doesn't ship in the initial
// dashboard bundle.
const PulseCreateTaskModalLazy = dynamic(
  () => import("@/components/CreateTaskModal"),
  { ssr: false }
);

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

type ActivityRow = {
  id: number;
  actor_name: string | null;
  type: string;
  subject_label: string | null;
  amount_cents: number | null;
  created_at: string;
};

function activityVerb(type: string): { color: string; verb: string } {
  if (type === "job.sold") return { color: PULSE.green, verb: "sold" };
  if (type === "job.started") return { color: PULSE.cyan, verb: "started" };
  if (type === "job.completed") return { color: PULSE.violetVar, verb: "completed" };
  if (type === "job.paid") return { color: PULSE.green, verb: "got paid for" };
  if (type === "payment.recorded") return { color: PULSE.green, verb: "recorded payment on" };
  if (type === "estimate.approved") return { color: PULSE.green, verb: "approved estimate for" };
  if (type === "invoice.paid") return { color: PULSE.green, verb: "paid invoice for" };
  if (type === "task.completed") return { color: PULSE.violetVar, verb: "completed task" };
  return { color: PULSE.textSubtle, verb: type };
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatAmount(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PulseActivityCard({ jobs: _jobs }: { jobs: LiveJob[] }) {
  void _jobs;
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/activity?limit=10")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ActivityRow[]) => {
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">Activity</h2>
        <LiveBadge />
      </div>
      {loading ? (
        <p
          className="py-8 text-center text-[12.5px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p
          className="py-8 text-center text-[12.5px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          No recent activity.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {items.map((it) => {
            const who = it.actor_name || "System";
            const { color, verb } = activityVerb(it.type);
            const amount =
              it.amount_cents != null
                ? ` (${formatAmount(it.amount_cents)})`
                : "";
            return (
              <li key={it.id} className="flex items-start gap-3">
                <span
                  className="mt-1 w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: `${color}1F`,
                    color,
                    border: `1px solid ${color}33`,
                  }}
                >
                  {who[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12.5px] font-bold leading-snug"
                    style={{ color: PULSE.textMuted }}
                  >
                    <span className="font-bold" style={{ color: PULSE.text }}>
                      {who}
                    </span>{" "}
                    {verb}
                    {it.subject_label ? ` ${it.subject_label}` : ""}
                    {amount}
                  </div>
                  <div
                    className="text-xs mt-0.5 font-bold"
                    style={{ color: PULSE.textDim }}
                  >
                    {formatAgo(it.created_at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
