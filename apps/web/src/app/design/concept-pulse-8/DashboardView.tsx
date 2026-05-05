"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldChart,
  BoldScheduleRow,
  LiveBadge,
  PipelineBars,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCentsShort,
  greeting,
} from "../_pulse_widgets";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

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
      <PulsePreviewBar active="8" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-8"
        initials={initials}
        variantLabel="Owner"
        variantSlug="8"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="px-8 py-7">
          {/* Compact header */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1.5"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel()}
              </div>
              <h1 className="text-[32px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[12.5px] mt-1.5 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} completed this month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-lg px-3 text-[12px] font-bold flex items-center gap-2 w-64"
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
                className="h-9 rounded-lg px-3 text-[12px] font-bold flex items-center gap-2"
                style={{ background: PULSE.text, color: PULSE.bg }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Main */}
            <div className="space-y-4 min-w-0">
              {/* KPI strip — slightly smaller numbers, tighter padding */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CompactKpi
                  label="Revenue"
                  value={formatCentsShort(revenue.totalCents)}
                  delta="+12.4%"
                  deltaPositive
                />
                <CompactKpi
                  label="Jobs done"
                  value={String(completedCount)}
                  delta="+8"
                  deltaPositive
                />
                <CompactKpi
                  label="Close rate"
                  value={`${(closeRate * 100).toFixed(0)}%`}
                  delta="−1.1%"
                  deltaPositive={false}
                />
              </div>

              {/* Chart */}
              <section
                className="rounded-2xl p-5"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="text-[14px] font-bold tracking-tight">Revenue</h2>
                    <p
                      className="text-[11px] mt-0.5 font-semibold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      Last 12 weeks
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 p-0.5 rounded-full"
                    style={{ background: PULSE.bgAlt }}
                  >
                    {["12W", "26W", "YTD"].map((r, i) => (
                      <button
                        key={r}
                        className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold"
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
                <BoldChart days={revenue.daily} height={220} />
              </section>

              {/* Schedule — tighter, more rows visible */}
              <section
                className="rounded-2xl p-5"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <h2 className="text-[14px] font-bold tracking-tight">Today's schedule</h2>
                    <p
                      className="text-[11px] mt-0.5 font-semibold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      {jobs.length} of {Math.max(jobs.length, 12)} visible
                    </p>
                  </div>
                  <button
                    className="text-[11px] font-bold"
                    style={{ color: PULSE.violetSoft }}
                  >
                    View all →
                  </button>
                </div>
                {jobs.length === 0 ? (
                  <p
                    className="py-10 text-center text-[12.5px] font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    Nothing on the calendar today.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {jobs.slice(0, 6).map((j) => (
                      <BoldScheduleRow key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Side rail — narrower */}
            <div className="space-y-4">
              <section
                className="rounded-2xl p-5"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="mb-3">
                  <h2 className="text-[14px] font-bold tracking-tight">Pipeline</h2>
                  <p
                    className="text-[11px] mt-0.5 font-semibold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    35 active
                  </p>
                </div>
                <PipelineBars entries={SAMPLE_PIPELINE} />
              </section>

              <section
                className="rounded-2xl p-5"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-bold tracking-tight">Activity</h2>
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

function CompactKpi({
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
      className="rounded-2xl p-4"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-bold" style={{ color: PULSE.textSubtle }}>
          {label}
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
          style={{
            background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
            color: deltaPositive ? PULSE.green : PULSE.red,
          }}
        >
          {delta}
        </span>
      </div>
      <div className="text-[28px] font-bold tracking-tight tabular-nums leading-none mt-1">
        {value}
      </div>
      <div className="text-[10.5px] mt-1.5 font-semibold" style={{ color: PULSE.textDim }}>
        vs last week
      </div>
    </div>
  );
}
