"use client";

import Link from "next/link";
import { PULSE } from "./theme";
import { PulseIcon } from "./Icon";

// ---------- Types -------------------------------------------------------

export type RevenuePoint = { date: string; cents: number };
export type RevenueSummary = {
  totalCents: number;
  jobsCompleted: number;
  customersCount: number;
  daily: RevenuePoint[];
};
export type LiveJob = {
  id: number;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: string;
  customer_name: string;
  customer_address: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

// ---------- Formatters --------------------------------------------------

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

export function dateLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const mag = Math.pow(10, exp);
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

// ---------- Header ------------------------------------------------------

export function PulseHeader({
  firstName,
  jobs,
  completedCount,
}: {
  firstName: string;
  jobs: LiveJob[];
  completedCount: number;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
      <div>
        <div
          className="text-[11px] uppercase tracking-[0.22em] font-extrabold mb-3"
          style={{ color: PULSE.textDim }}
        >
          {dateLabel()}
        </div>
        <h1 className="text-[48px] font-extrabold tracking-tight leading-none">
          {greeting(new Date().getHours())}, {firstName}.
        </h1>
        <p className="text-[14.5px] mt-3 font-bold" style={{ color: PULSE.textMuted }}>
          {jobs.length} jobs today · {completedCount} completed this month
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="h-11 rounded-2xl px-4 text-[13px] font-bold flex items-center gap-2 w-72"
          style={{
            background: PULSE.bgAlt,
            color: PULSE.textSubtle,
            border: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <PulseIcon name="search" className="w-3.5 h-3.5" />
          Search anything
        </button>
      </div>
    </div>
  );
}

// ---------- Compact KPI card -------------------------------------------

export function CompactHeroKpi({
  label,
  value,
  delta,
  deltaPositive,
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="min-w-0">
        <div
          className="text-[11px] uppercase tracking-[0.18em] font-extrabold mb-1.5"
          style={{ color: PULSE.textSubtle }}
        >
          {label}
        </div>
        <div className="text-[26px] font-black tracking-tight leading-none">
          {value}
        </div>
      </div>
      <span
        className="text-[11px] px-2 py-0.5 rounded-md font-extrabold whitespace-nowrap"
        style={{
          background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
          color: deltaPositive ? PULSE.green : PULSE.red,
        }}
      >
        {delta}
      </span>
    </div>
  );
}

// ---------- Hero chart (white-stroke wavy) -----------------------------
// Path renders inside an SVG with preserveAspectRatio="none" so it stretches
// to fill the container. Axis labels are HTML overlays positioned by percent
// so text stays at native aspect ratio at any width.

export function HeroChart({
  days,
  height = 300,
}: {
  days: RevenuePoint[];
  height?: number;
}) {
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
  const id = `hero-${Math.random().toString(36).slice(2, 7)}`;
  const padLPct = (padL / w) * 100;
  const padRPct = (padR / w) * 100;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
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
          stroke={PULSE.text}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
      </div>
    </div>
  );
}

// ---------- Chart hero card (with embedded headline + range pills) ------

export function PulseChartHero({
  revenue,
  height = 300,
}: {
  revenue: RevenueSummary;
  height?: number;
}) {
  return (
    <section
      className="rounded-2xl p-7"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <div>
          <div
            className="text-[12px] uppercase tracking-[0.22em] font-extrabold mb-3"
            style={{ color: PULSE.textSubtle }}
          >
            Revenue · Last 12 weeks
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[52px] font-black tracking-tight leading-none">
              {formatCentsShort(revenue.totalCents)}
            </span>
            <span
              className="text-[13px] font-extrabold px-2.5 py-1 rounded-md"
              style={{ background: `${PULSE.green}1F`, color: PULSE.green }}
            >
              +12.4%
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-1 p-1 rounded-full"
          style={{ background: PULSE.bgAlt }}
        >
          {["12W", "26W", "YTD"].map((r, i) => (
            <button
              key={r}
              className="px-3.5 py-1 rounded-full text-[11.5px] font-extrabold"
              style={{
                background: i === 0 ? PULSE.text : "transparent",
                color: i === 0 ? PULSE.bg : PULSE.textMuted,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <HeroChart days={revenue.daily} height={height} />
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
      <PulseStatusChip status={job.status} />
      {showTech && job.technician_name && (
        <div
          className="text-[12px] font-semibold w-24 truncate text-right hidden xl:block"
          style={{ color: PULSE.textMuted }}
        >
          {job.technician_name}
        </div>
      )}
      <div
        className="text-[14px] font-bold w-20 text-right"
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
          Today's schedule
        </h2>
        <Link
          href="/schedule"
          className="text-[11.5px] font-extrabold"
          style={{ color: PULSE.violetSoft }}
        >
          View all →
        </Link>
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

export type PipelineEntry = {
  label: string;
  count: number;
  value: number;
  pct: number;
};

export const PLACEHOLDER_PIPELINE: PipelineEntry[] = [
  { label: "New leads", count: 12, value: 540_000, pct: 0.4 },
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
                className="text-[11px] font-bold"
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
      <p className="mt-3 text-[13.5px] font-extrabold">{title}</p>
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
          className="text-[10.5px] font-extrabold uppercase tracking-[0.18em]"
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
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: PULSE.violet,
            color: "#fff",
            boxShadow: `0 0 12px ${PULSE.violetGlow}`,
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
      )}
    </section>
  );
}
