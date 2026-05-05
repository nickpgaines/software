"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldKpi,
  BoldScheduleRow,
  LiveBadge,
  PipelineBars,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCentsShort,
  greeting,
} from "../_pulse_widgets";
import type { LiveJob, RevenueSummary, RevenuePoint } from "../concept-live/_data";

const GROUP = ["8", "9", "10", "11"];

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

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="11" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-11"
        initials={initials}
        variantLabel="Owner"
        variantSlug="11"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="px-10 py-10">
          {/* Header — same as P3 */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] font-bold mb-2"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel()}
              </div>
              <h1 className="text-[44px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[14px] mt-2 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} completed this month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-10 rounded-xl px-4 text-[12.5px] font-bold flex items-center gap-2 w-72"
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
                className="h-10 rounded-xl px-4 text-[12.5px] font-bold flex items-center gap-2"
                style={{ background: PULSE.text, color: PULSE.bg }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            <div className="space-y-5 min-w-0">
              {/* KPI strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BoldKpi
                  label="Revenue"
                  value={formatCentsShort(revenue.totalCents)}
                  delta="+12.4%"
                  deltaPositive
                />
                <BoldKpi
                  label="Jobs done"
                  value={String(completedCount)}
                  delta="+8"
                  deltaPositive
                />
                <BoldKpi
                  label="Close rate"
                  value={`${(closeRate * 100).toFixed(0)}%`}
                  delta="−1.1%"
                  deltaPositive={false}
                />
              </div>

              {/* Taller chart with axis labels + grid */}
              <section
                className="rounded-2xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight">Revenue</h2>
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className="text-[36px] font-bold tracking-tight tabular-nums leading-none">
                        {formatCentsShort(revenue.totalCents)}
                      </span>
                      <span
                        className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-md"
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
                        className="px-3 py-1 rounded-full text-[11px] font-bold"
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
                <ChartedReport days={revenue.daily} />
              </section>

              {/* Schedule — slightly fewer rows, chart gets the focus */}
              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight">Today's schedule</h2>
                    <p
                      className="text-[11.5px] mt-0.5 font-semibold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      {jobs.length} of {Math.max(jobs.length, 12)} visible
                    </p>
                  </div>
                  <button
                    className="text-[11.5px] font-bold"
                    style={{ color: PULSE.violetSoft }}
                  >
                    View all →
                  </button>
                </div>
                {jobs.length === 0 ? (
                  <p
                    className="py-12 text-center text-[13px] font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    Nothing on the calendar today.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {jobs.slice(0, 3).map((j) => (
                      <BoldScheduleRow key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Side rail — same as P3 */}
            <div className="space-y-5">
              <section
                className="rounded-2xl p-6"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="mb-4">
                  <h2 className="text-[15px] font-bold tracking-tight">Pipeline</h2>
                  <p
                    className="text-[11.5px] mt-0.5 font-semibold"
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
                  <h2 className="text-[15px] font-bold tracking-tight">Activity</h2>
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

function ChartedReport({ days }: { days: RevenuePoint[] }) {
  if (days.length === 0) {
    return (
      <div
        className="h-[340px] flex items-center justify-center text-[13px] font-bold"
        style={{ color: PULSE.textDim }}
      >
        No data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 340;
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
    <div className="w-full h-[340px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="charted-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
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
                fontSize="10"
                fontWeight="700"
                fill={PULSE.textDim}
              >
                ${Math.round(tick / 100)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#charted-area)" />
        <path
          d={path}
          fill="none"
          stroke={PULSE.text}
          strokeWidth="2.5"
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
              fontSize="10"
              fontWeight="700"
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
