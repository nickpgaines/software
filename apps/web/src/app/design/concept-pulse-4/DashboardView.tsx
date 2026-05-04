"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldChart,
  BoldKpi,
  BoldScheduleRow,
  LiveBadge,
  PipelineBars,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCentsShort,
  greeting,
} from "../_pulse_widgets";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

const GROUP = ["4", "5", "6", "7"];

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
      <PulsePreviewBar active="4" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-4"
        initials={initials}
        variantLabel="Owner"
        variantSlug="4"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="max-w-4xl mx-auto px-12 py-16">
          {/* Header — generous breathing room */}
          <div className="mb-14">
            <div
              className="text-[10.5px] uppercase tracking-[0.24em] font-bold mb-3"
              style={{ color: PULSE.textDim }}
            >
              {dateLabel()}
            </div>
            <h1 className="text-[56px] font-bold tracking-tight leading-[0.95] mb-3">
              {greeting(new Date().getHours())}, {firstName}.
            </h1>
            <p className="text-[15px] font-semibold" style={{ color: PULSE.textMuted }}>
              {jobs.length} jobs today · {completedCount} completed this month
            </p>

            <div className="mt-6 flex items-center gap-2">
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

          {/* KPI strip — large, breathing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
            <BoldKpi
              label="Revenue"
              value={formatCentsShort(revenue.totalCents)}
              delta="+12.4%"
              deltaPositive
              size="large"
            />
            <BoldKpi
              label="Jobs done"
              value={String(completedCount)}
              delta={`+${Math.max(1, Math.round(completedCount * 0.1))}`}
              deltaPositive
              size="large"
            />
            <BoldKpi
              label="Close rate"
              value={`${(closeRate * 100).toFixed(0)}%`}
              delta="−1.1%"
              deltaPositive={false}
              size="large"
            />
          </div>

          {/* Big chart — full width */}
          <section
            className="rounded-2xl p-9 mb-12"
            style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
          >
            <div className="flex items-baseline justify-between mb-7">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">Revenue</h2>
                <p
                  className="text-[12px] mt-0.5 font-semibold"
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
            <BoldChart days={revenue.daily} height={300} />
          </section>

          {/* Schedule */}
          <section
            className="rounded-2xl p-7 mb-12"
            style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
          >
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">Today's schedule</h2>
                <p
                  className="text-[12px] mt-0.5 font-semibold"
                  style={{ color: PULSE.textSubtle }}
                >
                  {jobs.length} of {Math.max(jobs.length, 12)} visible
                </p>
              </div>
              <button className="text-[11.5px] font-bold" style={{ color: PULSE.violetSoft }}>
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
                  <BoldScheduleRow key={j.id} job={j} showTech={false} />
                ))}
              </div>
            )}
          </section>

          {/* Pipeline + Activity in a 2-up — calm, not packed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <section
              className="rounded-2xl p-7"
              style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
            >
              <div className="mb-5">
                <h2 className="text-[16px] font-bold tracking-tight">Pipeline</h2>
                <p
                  className="text-[12px] mt-0.5 font-semibold"
                  style={{ color: PULSE.textSubtle }}
                >
                  35 active
                </p>
              </div>
              <PipelineBars entries={SAMPLE_PIPELINE} />
            </section>

            <section
              className="rounded-2xl p-7"
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
      </main>
    </div>
  );
}
