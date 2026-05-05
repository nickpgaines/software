"use client";

// Composable building blocks shared by P12+ pulse dashboard variants.
// Each function renders one section of the dashboard so a variant's
// DashboardView is just a layout composition.

import { PULSE } from "./_pulse_theme";
import { PulseIcon } from "./_pulse_chrome";
import {
  ActivityFeed,
  BoldScheduleRow,
  CompactHeroKpi,
  HeroChart,
  LiveBadge,
  PipelineBars,
  PulseEmptyState,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCentsShort,
  greeting,
} from "./_pulse_widgets";
import type { LiveJob, RevenueSummary } from "./concept-live/_data";

// ---------- Header --------------------------------------------------------

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
        <button
          className="h-11 rounded-2xl px-5 text-[13px] font-extrabold flex items-center gap-2"
          style={{ background: PULSE.text, color: PULSE.bg }}
        >
          <PulseIcon name="plus" className="w-3.5 h-3.5" />
          New job
        </button>
      </div>
    </div>
  );
}

// ---------- Chart hero card ----------------------------------------------

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

// ---------- Five widget cards (Schedule / Inbox / Tasks / Pipeline / Activity)
// All sized larger than the KPI strip so the visual hierarchy reads as
// "widgets > KPIs".

export function PulseScheduleCard({
  jobs,
  rows = 3,
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
        <h2 className="text-[15px] font-extrabold tracking-tight">Today's schedule</h2>
        <button className="text-[11.5px] font-extrabold" style={{ color: PULSE.violetSoft }}>
          View all →
        </button>
      </div>
      {jobs.length === 0 ? (
        <PulseEmptyState
          iconNode={<PulseIcon name="calendar" />}
          title="Nothing on the calendar"
          sub="Today's jobs will appear here once scheduled."
        />
      ) : (
        <div className="space-y-2">
          {jobs.slice(0, rows).map((j) => (
            <BoldScheduleRow key={j.id} job={j} showTech={false} />
          ))}
        </div>
      )}
    </section>
  );
}

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
        iconNode={<PulseIcon name="message" />}
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
        iconNode={<PulseIcon name="doc" />}
        title="No tasks yet"
        sub="Create one to keep your team organized."
      />
    </section>
  );
}

export function PulsePipelineCard() {
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
    >
      <div className="mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight">Pipeline</h2>
        <p className="text-[12px] mt-1 font-bold" style={{ color: PULSE.textSubtle }}>
          35 active
        </p>
      </div>
      <PipelineBars entries={SAMPLE_PIPELINE} />
    </section>
  );
}

export function PulseActivityCard({ jobs }: { jobs: LiveJob[] }) {
  return (
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
  );
}

// ---------- Hero body composition ---------------------------------------
// Used by P17–P20: same content (KPIs above chart, chart hero, 2-up of
// Schedule + Pipeline, then 3-up of Inbox + Tasks + Activity). Each
// variant renders this inside a different max-width container.

export function PulseHeroBody({
  jobs,
  revenue,
}: {
  jobs: LiveJob[];
  revenue: RevenueSummary;
}) {
  const completedCount = revenue.jobsCompleted;
  const closeRate = 0.34;
  const arrCents = revenue.totalCents * 12;
  const jobsSold = completedCount + jobs.length;

  return (
    <>
      {/* KPIs at the top */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <CompactHeroKpi
          label="Close rate"
          value={`${(closeRate * 100).toFixed(0)}%`}
          delta="−1.1%"
          deltaPositive={false}
        />
        <CompactHeroKpi
          label="ARR"
          value={formatCentsShort(arrCents)}
          delta="+8.6%"
          deltaPositive
        />
        <CompactHeroKpi
          label="Jobs sold"
          value={String(jobsSold)}
          delta="+12"
          deltaPositive
        />
      </div>

      {/* Chart hero */}
      <div className="mb-5">
        <PulseChartHero revenue={revenue} />
      </div>

      {/* 2-up larger widgets: Schedule + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <PulseScheduleCard jobs={jobs} rows={5} />
        <PulsePipelineCard />
      </div>

      {/* 3-up smaller widgets: Inbox + Tasks + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PulseInboxCard />
        <PulseTasksCard />
        <PulseActivityCard jobs={jobs} />
      </div>
    </>
  );
}
