"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldScheduleRow,
  LiveBadge,
  PipelineBars,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCentsShort,
  greeting,
} from "../_pulse_widgets";
import type { LiveJob, RevenueSummary, RevenuePoint } from "../concept-live/_data";

const GROUP = ["12"];

export default function DashboardView({
  firstName,
  initials,
  jobs,
  revenue,
}: {
  firstName: string;
  initials: string;
  jobs: LiveJob[];
  revenue: RevenueSummary;
}) {
  const completedCount = revenue.jobsCompleted;
  const closeRate = 0.34;
  // ARR = monthly revenue projected to 12 months
  const arrCents = revenue.totalCents * 12;
  // "Jobs sold" — booked jobs this month (completed + scheduled)
  const jobsSold = completedCount + jobs.length;

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="12" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-12"
        initials={initials}
        variantLabel="Owner"
        variantSlug="12"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="px-10 py-10">
          {/* Header — thicker, larger */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-9">
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.22em] font-extrabold mb-3"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel()}
              </div>
              <h1 className="text-[52px] font-extrabold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[15px] mt-3 font-bold" style={{ color: PULSE.textMuted }}>
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
              <button
                className="h-11 rounded-2xl px-5 text-[13px] font-extrabold flex items-center gap-2"
                style={{ background: PULSE.text, color: PULSE.bg }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          {/* Layout: main + right rail */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            <div className="space-y-5 min-w-0">
              {/* Hero chart — the headline number lives inside the card,
                  no separate Revenue KPI exists in the strip below. */}
              <section
                className="rounded-2xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <div
                      className="text-[12px] uppercase tracking-[0.22em] font-extrabold mb-3"
                      style={{ color: PULSE.textSubtle }}
                    >
                      Revenue · Last 12 weeks
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[52px] font-black tracking-tight tabular-nums leading-none">
                        {formatCentsShort(revenue.totalCents)}
                      </span>
                      <span
                        className="text-[13px] font-extrabold tabular-nums px-2.5 py-1 rounded-md"
                        style={{
                          background: `${PULSE.green}1F`,
                          color: PULSE.green,
                        }}
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
                <HeroChart days={revenue.daily} />
              </section>

              {/* Three KPIs — Close rate · ARR · Jobs sold */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <HeroKpi
                  label="Close rate"
                  value={`${(closeRate * 100).toFixed(0)}%`}
                  delta="−1.1%"
                  deltaPositive={false}
                />
                <HeroKpi
                  label="ARR"
                  value={formatCentsShort(arrCents)}
                  delta="+8.6%"
                  deltaPositive
                />
                <HeroKpi
                  label="Jobs sold"
                  value={String(jobsSold)}
                  delta="+12"
                  deltaPositive
                />
              </div>

              {/* Three-up bottom row: Schedule · Inbox · Tasks */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Schedule — tallest because it has rows */}
                <section
                  className="lg:col-span-1 rounded-2xl p-6"
                  style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
                >
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-[15px] font-extrabold tracking-tight">
                      Today's schedule
                    </h2>
                    <button
                      className="text-[11.5px] font-extrabold"
                      style={{ color: PULSE.violetSoft }}
                    >
                      View all →
                    </button>
                  </div>
                  {jobs.length === 0 ? (
                    <EmptyState
                      icon="calendar"
                      title="Nothing on the calendar"
                      sub="Today's jobs will appear here once scheduled."
                    />
                  ) : (
                    <div className="space-y-2">
                      {jobs.slice(0, 3).map((j) => (
                        <BoldScheduleRow key={j.id} job={j} showTech={false} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Inbox */}
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
                  <EmptyState
                    icon="message"
                    title="No recent conversations"
                    sub="New conversations will appear here."
                  />
                </section>

                {/* Tasks / To-do */}
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
                  <EmptyState
                    icon="doc"
                    title="No tasks yet"
                    sub="Create one to keep your team organized."
                  />
                </section>
              </div>
            </div>

            {/* Right rail — Pipeline + Activity */}
            <div className="space-y-5">
              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="mb-4">
                  <h2 className="text-[15px] font-extrabold tracking-tight">Pipeline</h2>
                  <p
                    className="text-[12px] mt-1 font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    35 active
                  </p>
                </div>
                <PipelineBars entries={SAMPLE_PIPELINE} />
              </section>

              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-extrabold tracking-tight">Activity</h2>
                  <LiveBadge />
                </div>
                <ActivityFeed jobs={jobs} />
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function HeroKpi({
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
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-extrabold" style={{ color: PULSE.textSubtle }}>
          {label}
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-md font-extrabold tabular-nums"
          style={{
            background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
            color: deltaPositive ? PULSE.green : PULSE.red,
          }}
        >
          {delta}
        </span>
      </div>
      <div className="text-[44px] font-black tracking-tight tabular-nums leading-none mt-1">
        {value}
      </div>
      <div className="text-[11.5px] mt-3 font-bold" style={{ color: PULSE.textDim }}>
        vs last week
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="py-8 flex flex-col items-center text-center">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{
          background: PULSE.bgAlt,
          color: PULSE.textSubtle,
          border: `1px solid ${PULSE.cardBorder}`,
        }}
      >
        <PulseIcon name={icon} />
      </div>
      <p className="mt-3 text-[13px] font-extrabold">{title}</p>
      <p
        className="text-[11.5px] mt-1 font-bold max-w-[18ch]"
        style={{ color: PULSE.textSubtle }}
      >
        {sub}
      </p>
    </div>
  );
}

// ---- Hero chart: bigger, taller, axis labels + grid lines, headline lives
//      in the card header above (not inside the chart) -----------------

function HeroChart({ days }: { days: RevenuePoint[] }) {
  if (days.length === 0) {
    return (
      <div
        className="h-[320px] flex items-center justify-center text-[13px] font-extrabold"
        style={{ color: PULSE.textDim }}
      >
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 320;
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

  return (
    <div className="w-full h-[320px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, i) => {
          const yp = y(tick);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={w - padR}
                y1={yp}
                y2={yp}
                stroke={PULSE.cardBorder}
                strokeDasharray="2 4"
              />
              <text
                x={padL - 8}
                y={yp + 3}
                textAnchor="end"
                fontSize="11"
                fontWeight="800"
                fill={PULSE.textDim}
              >
                ${Math.round(tick / 100)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#hero-area)" />
        <path
          d={path}
          fill="none"
          stroke={PULSE.text}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {days.map((d, i) =>
          i % everyN === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={h - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill={PULSE.textDim}
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
