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
      <PulsePreviewBar active="9" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-9"
        initials={initials}
        variantLabel="Owner"
        variantSlug="9"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="px-12 py-12">
          {/* Larger header */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-9">
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.24em] font-bold mb-3"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel()}
              </div>
              <h1 className="text-[52px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[14.5px] mt-3 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} completed this month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-11 rounded-2xl px-4 text-[13px] font-bold flex items-center gap-2 w-80"
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
                className="h-11 rounded-2xl px-5 text-[13px] font-bold flex items-center gap-2"
                style={{ background: PULSE.text, color: PULSE.bg }}
              >
                <PulseIcon name="plus" className="w-3.5 h-3.5" />
                New job
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Main */}
            <div className="space-y-6 min-w-0">
              {/* Larger KPIs, rounded-3xl */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <PremiumKpi
                  label="Revenue"
                  value={formatCentsShort(revenue.totalCents)}
                  delta="+12.4%"
                  deltaPositive
                />
                <PremiumKpi
                  label="Jobs done"
                  value={String(completedCount)}
                  delta="+8"
                  deltaPositive
                />
                <PremiumKpi
                  label="Close rate"
                  value={`${(closeRate * 100).toFixed(0)}%`}
                  delta="−1.1%"
                  deltaPositive={false}
                />
              </div>

              {/* Bigger chart, rounded-3xl */}
              <section
                className="rounded-3xl p-8"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-6">
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight">Revenue</h2>
                    <p
                      className="text-[12px] mt-1 font-semibold"
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
                        className="px-3.5 py-1 rounded-full text-[11.5px] font-bold"
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
                <BoldChart days={revenue.daily} height={300} />
              </section>

              {/* Schedule */}
              <section
                className="rounded-3xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight">Today's schedule</h2>
                    <p
                      className="text-[12px] mt-1 font-semibold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      {jobs.length} of {Math.max(jobs.length, 12)} visible
                    </p>
                  </div>
                  <button
                    className="text-[12px] font-bold"
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
                  <div className="space-y-2.5">
                    {jobs.slice(0, 4).map((j) => (
                      <BoldScheduleRow key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Side rail — wider, rounded-3xl */}
            <div className="space-y-6">
              <section
                className="rounded-3xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="mb-5">
                  <h2 className="text-[16px] font-bold tracking-tight">Pipeline</h2>
                  <p
                    className="text-[12px] mt-1 font-semibold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    35 active
                  </p>
                </div>
                <PipelineBars entries={SAMPLE_PIPELINE} />
              </section>

              <section
                className="rounded-3xl p-7"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[16px] font-bold tracking-tight">Activity</h2>
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

function PremiumKpi({
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
      className="rounded-3xl p-7"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-bold" style={{ color: PULSE.textSubtle }}>
          {label}
        </div>
        <span
          className="text-[11px] px-2.5 py-0.5 rounded-md font-bold tabular-nums"
          style={{
            background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
            color: deltaPositive ? PULSE.green : PULSE.red,
          }}
        >
          {delta}
        </span>
      </div>
      <div className="text-[42px] font-bold tracking-tight tabular-nums leading-none mt-1">
        {value}
      </div>
      <div className="text-[11.5px] mt-3 font-semibold" style={{ color: PULSE.textDim }}>
        vs last week
      </div>
    </div>
  );
}
