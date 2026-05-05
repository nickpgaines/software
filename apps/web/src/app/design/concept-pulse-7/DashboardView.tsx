"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar, PulseIcon } from "../_pulse_chrome";
import {
  ActivityFeed,
  BoldKpi,
  BoldScheduleRow,
  LiveBadge,
  SAMPLE_PIPELINE,
  dateLabel,
  formatCentsShort,
  greeting,
} from "../_pulse_widgets";
import type { LiveJob, RevenueSummary, RevenuePoint } from "../concept-live/_data";

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
  const days = revenue.daily;

  // Per-metric scaled trend lines from the same daily series.
  const todayTrend: RevenuePoint[] = days.map((d) => ({
    date: d.date,
    cents: Math.round(d.cents * 0.18),
  }));
  const completedTrend: RevenuePoint[] = days.map((d, i) => ({
    date: d.date,
    cents: Math.round(d.cents * 0.001 * (1 + Math.sin(i * 0.3) * 0.3)),
  }));
  const closeRateTrend: RevenuePoint[] = days.map((_, i) => ({
    date: days[i].date,
    cents: Math.round(50 + Math.sin(i * 0.2) * 18 + i * 0.4),
  }));
  const customersTrend: RevenuePoint[] = days.map((_, i) => ({
    date: days[i].date,
    cents: Math.round(revenue.customersCount + i * 0.3 + Math.sin(i * 0.5) * 2),
  }));

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="7" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-7"
        initials={initials}
        variantLabel="Owner"
        variantSlug="7"
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

          {/* Five KPI cards, each with its own sparkline.
              The sparklines replace the standalone hero chart entirely. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
            <BoldKpi
              label="Revenue"
              value={formatCentsShort(revenue.totalCents)}
              delta="+12.4%"
              deltaPositive
              sparklineDays={days}
            />
            <BoldKpi
              label="Today"
              value={formatCentsShort(todayCents)}
              delta={`${jobs.length} jobs`}
              deltaPositive
              sparklineDays={todayTrend}
            />
            <BoldKpi
              label="Jobs done"
              value={String(completedCount)}
              delta="+8"
              deltaPositive
              sparklineDays={completedTrend}
            />
            <BoldKpi
              label="Close rate"
              value={`${(closeRate * 100).toFixed(0)}%`}
              delta="−1.1%"
              deltaPositive={false}
              sparklineDays={closeRateTrend}
            />
            <BoldKpi
              label="Customers"
              value={String(revenue.customersCount)}
              delta="+3"
              deltaPositive
              sparklineDays={customersTrend}
            />
          </div>

          {/* Pipeline as a horizontal strip — different from the stacked side rail */}
          <section
            className="rounded-2xl p-6 mb-5"
            style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
          >
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-bold tracking-tight">Pipeline</h2>
                <p
                  className="text-[12px] mt-0.5 font-semibold"
                  style={{ color: PULSE.textSubtle }}
                >
                  35 active opportunities
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {SAMPLE_PIPELINE.map((p) => (
                <div key={p.label}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[12.5px] font-bold">{p.label}</span>
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
                        background: `linear-gradient(90deg, ${PULSE.violet}, ${PULSE.violetSoft})`,
                      }}
                    />
                  </div>
                </div>
              ))}
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
                  {jobs.slice(0, 6).map((j) => (
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
