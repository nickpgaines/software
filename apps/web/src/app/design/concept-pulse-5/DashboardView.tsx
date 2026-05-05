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
  const todayCents = jobs.reduce((s, j) => s + (j.price_cents || 0), 0);
  const completedCount = revenue.jobsCompleted;
  const closeRate = 0.34;

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="5" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-5"
        initials={initials}
        variantLabel="Owner"
        variantSlug="5"
        style="sectioned"
      />

      <main className="ml-60">
        {/* Edge-to-edge — no max width */}
        <div className="px-6 py-6">
          {/* Compact header */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1.5"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel("short")}
              </div>
              <h1 className="text-[28px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[12.5px] mt-1.5 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} this month · 4 unread
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
                Search
              </button>
              <button
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{
                  background: PULSE.bgAlt,
                  color: PULSE.textMuted,
                  border: `1px solid ${PULSE.cardBorder}`,
                }}
              >
                <PulseIcon name="bell" />
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

          {/* Five-up KPI strip — denser */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
            <BoldKpi
              label="Revenue"
              value={formatCentsShort(revenue.totalCents)}
              delta="+12.4%"
              deltaPositive
              size="compact"
            />
            <BoldKpi
              label="Today"
              value={formatCentsShort(todayCents)}
              delta={`${jobs.length} jobs`}
              deltaPositive
              size="compact"
            />
            <BoldKpi
              label="Jobs done"
              value={String(completedCount)}
              delta="+8"
              deltaPositive
              size="compact"
            />
            <BoldKpi
              label="Close rate"
              value={`${(closeRate * 100).toFixed(0)}%`}
              delta="−1.1%"
              deltaPositive={false}
              size="compact"
            />
            <BoldKpi
              label="Customers"
              value={String(revenue.customersCount)}
              delta="+3"
              deltaPositive
              size="compact"
            />
          </div>

          {/* Main + side rail (3:1) */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3">
            {/* Main column */}
            <div className="space-y-3 min-w-0">
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

              {/* Schedule (more rows visible) */}
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
                    {jobs.slice(0, 8).map((j) => (
                      <BoldScheduleRow key={j.id} job={j} showTech />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Side rail */}
            <div className="space-y-3">
              <section
                className="rounded-2xl p-5"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="mb-4">
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[14px] font-bold tracking-tight">Activity</h2>
                  <LiveBadge />
                </div>
                <ActivityFeed jobs={jobs} />
              </section>

              {/* Bonus: Top performer card for extra density */}
              <section
                className="rounded-2xl p-5"
                style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-bold tracking-tight">Top this month</h2>
                </div>
                {jobs[0]?.technician_name ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold"
                      style={{
                        background: `${PULSE.violet}1F`,
                        color: PULSE.violetSoft,
                        border: `1px solid ${PULSE.violet}33`,
                      }}
                    >
                      {jobs[0].technician_name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold truncate">
                        {jobs[0].technician_name}
                      </div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: PULSE.textSubtle }}
                      >
                        {jobs.filter((j) => j.technician_name === jobs[0].technician_name).length}{" "}
                        jobs assigned
                      </div>
                    </div>
                  </div>
                ) : (
                  <p
                    className="py-3 text-center text-[12px] font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    No assignments yet.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
