"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldChart,
  BoldKpi,
  LiveBadge,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCents,
  formatCentsShort,
  formatTime,
  greeting,
} from "../_pulse_widgets";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

const GROUP = ["8", "9", "10", "11"];

// Stage palette — one accent per pipeline stage so the rail reads at a glance.
const STAGE_COLORS = [PULSE.cyan, PULSE.violet, PULSE.amber, PULSE.green];

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
      <PulsePreviewBar active="10" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-10"
        initials={initials}
        variantLabel="Owner"
        variantSlug="10"
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
            {/* Main */}
            <div className="space-y-5 min-w-0">
              {/* KPI strip — same as P3 */}
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

              {/* Chart — same as P3 */}
              <section
                className="rounded-2xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight">Revenue</h2>
                    <p
                      className="text-[11.5px] mt-0.5 font-semibold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      Last 12 weeks
                    </p>
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
                <BoldChart days={revenue.daily} />
              </section>

              {/* Schedule — colored status chips */}
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
                    {jobs.slice(0, 4).map((j) => (
                      <ColoredScheduleRow key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Side rail */}
            <div className="space-y-5">
              {/* Pipeline with per-stage colors */}
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
                <div className="space-y-4">
                  {SAMPLE_PIPELINE.map((p, i) => {
                    const color = STAGE_COLORS[i % STAGE_COLORS.length];
                    return (
                      <div key={p.label}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="flex items-center gap-2 text-[12.5px] font-bold">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                            />
                            {p.label}
                          </span>
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
                              background: `linear-gradient(90deg, ${color}AA, ${color})`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Activity */}
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

// Colored status — replaces the white "On the way" pill with status-specific
// accent colors so the schedule reads richer.
function ColoredScheduleRow({ job }: { job: LiveJob }) {
  const { time, ampm } = formatTime(job.scheduled_at);
  const status = job.status;
  const color =
    status === "in_progress" || status === "on_the_way"
      ? PULSE.violet
      : status === "completed"
      ? PULSE.green
      : status === "cancelled"
      ? PULSE.red
      : PULSE.cyan;
  const label =
    status === "in_progress" || status === "on_the_way"
      ? "On the way"
      : status.replace(/_/g, " ");

  return (
    <div
      className="flex items-center gap-4 px-3 py-3 rounded-xl"
      style={{
        background: PULSE.bgAlt,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div
        className="w-1 self-stretch rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
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
      <span
        className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap"
        style={{
          background: `${color}1F`,
          color,
          border: `1px solid ${color}55`,
        }}
      >
        {label}
      </span>
      <div
        className="text-[14px] font-bold tabular-nums w-20 text-right"
        style={{ color: PULSE.text }}
      >
        {formatCents(job.price_cents)}
      </div>
    </div>
  );
}
