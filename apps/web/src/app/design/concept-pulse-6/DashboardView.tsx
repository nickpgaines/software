"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldDonut,
  BoldKpi,
  BoldScheduleRow,
  BoldSplitDonut,
  LiveBadge,
  dateLabel,
  formatCents,
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

  // Pipeline conversion: won / total
  const pipelineTotal = 12 + 8 + 9 + 6;
  const pipelineWon = 6;
  const conversion = pipelineTotal > 0 ? pipelineWon / pipelineTotal : 0;

  // Monthly target progress
  const target = Math.max(revenue.totalCents, 5_000_000);
  const monthlyProgress = target > 0 ? Math.min(1, revenue.totalCents / target) : 0;

  // Job split for split-donut
  const jobsScheduled = jobs.length;
  const jobsCompleted = completedCount;
  const jobsCancelled = 2;

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="6" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-6"
        initials={initials}
        variantLabel="Owner"
        variantSlug="6"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="max-w-6xl mx-auto px-8 py-10">
          {/* Header */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] font-bold mb-2"
                style={{ color: PULSE.textDim }}
              >
                {dateLabel()}
              </div>
              <h1 className="text-[40px] font-bold tracking-tight leading-none">
                {greeting(new Date().getHours())}, {firstName}.
              </h1>
              <p className="text-[13.5px] mt-2 font-semibold" style={{ color: PULSE.textMuted }}>
                {jobs.length} jobs today · {completedCount} completed this month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-10 rounded-xl px-4 text-[12.5px] font-bold flex items-center gap-2 w-64"
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

          {/* KPI strip on top */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
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

          {/* Donut hero — three rings */}
          <section
            className="rounded-2xl p-7 mb-5"
            style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
          >
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <h2 className="text-[15px] font-bold tracking-tight">Performance</h2>
                <p
                  className="text-[12px] mt-0.5 font-semibold"
                  style={{ color: PULSE.textSubtle }}
                >
                  This month at a glance
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Pipeline conversion */}
              <DonutTile
                title="Pipeline conversion"
                sub={`${pipelineWon} won of ${pipelineTotal}`}
              >
                <BoldDonut
                  value={conversion}
                  size={170}
                  stroke={16}
                  color={PULSE.violet}
                  colorEnd={PULSE.violetSoft}
                  centerLabel={`${(conversion * 100).toFixed(0)}%`}
                  centerSub="WON"
                />
              </DonutTile>

              {/* Monthly target */}
              <DonutTile
                title="Monthly target"
                sub={`${formatCents(revenue.totalCents)} of ${formatCents(target)}`}
              >
                <BoldDonut
                  value={monthlyProgress}
                  size={170}
                  stroke={16}
                  color={PULSE.green}
                  colorEnd="#4ade80"
                  centerLabel={`${(monthlyProgress * 100).toFixed(0)}%`}
                  centerSub="TARGET"
                />
              </DonutTile>

              {/* Jobs split */}
              <DonutTile title="Jobs this month" sub={`${jobsScheduled + jobsCompleted + jobsCancelled} total`}>
                <BoldSplitDonut
                  segments={[
                    { value: jobsCompleted, color: PULSE.green },
                    { value: jobsScheduled, color: PULSE.violet },
                    { value: jobsCancelled, color: PULSE.red },
                  ]}
                  size={170}
                  stroke={16}
                  centerLabel={String(jobsScheduled + jobsCompleted + jobsCancelled)}
                  centerSub="JOBS"
                />
                <div className="mt-4 grid grid-cols-3 gap-2 w-full">
                  <DonutLegend color={PULSE.green} label="Done" value={jobsCompleted} />
                  <DonutLegend color={PULSE.violet} label="Sched" value={jobsScheduled} />
                  <DonutLegend color={PULSE.red} label="Cancel" value={jobsCancelled} />
                </div>
              </DonutTile>
            </div>
          </section>

          {/* Schedule + activity */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
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
                  {jobs.slice(0, 5).map((j) => (
                    <BoldScheduleRow key={j.id} job={j} />
                  ))}
                </div>
              )}
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
      </main>
    </div>
  );
}

function DonutTile({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col items-center text-center"
      style={{ background: PULSE.bgAlt, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.2em] font-bold self-stretch text-left mb-4"
        style={{ color: PULSE.textSubtle }}
      >
        {title}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full">{children}</div>
      <div className="mt-4 text-[12px] font-semibold" style={{ color: PULSE.textMuted }}>
        {sub}
      </div>
    </div>
  );
}

function DonutLegend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span
          className="text-[9.5px] uppercase tracking-[0.16em] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          {label}
        </span>
      </div>
      <div className="text-[14px] font-bold tabular-nums tracking-tight mt-0.5">
        {value}
      </div>
    </div>
  );
}
