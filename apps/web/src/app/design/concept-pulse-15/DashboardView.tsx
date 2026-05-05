"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar } from "../_pulse_chrome";
import { CompactHeroKpi, formatCentsShort } from "../_pulse_widgets";
import {
  PulseActivityCard,
  PulseChartHero,
  PulseHeader,
  PulseInboxCard,
  PulsePipelineCard,
  PulseScheduleCard,
  PulseTasksCard,
} from "../_pulse_pieces";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

const GROUP = ["13", "14", "15", "16"];

// P15 — Full width (no max-width) · KPIs ABOVE chart · Pipeline + Activity
// stay BESIDE the main column in a right rail (the only variant in this
// group that keeps the rail).
// Main column: Header → KPI strip → chart hero → 3-up (Schedule/Inbox/Tasks).
// Right rail (360px): Pipeline + Activity stacked.
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
  const arrCents = revenue.totalCents * 12;
  const jobsSold = completedCount + jobs.length;

  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="15" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-15"
        initials={initials}
        variantLabel="Owner"
        variantSlug="15"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="px-10 py-10">
          <PulseHeader firstName={firstName} jobs={jobs} completedCount={completedCount} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            <div className="space-y-5 min-w-0">
              {/* KPIs ABOVE chart */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

              <PulseChartHero revenue={revenue} />

              {/* 3-up: Schedule, Inbox, Tasks */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <PulseScheduleCard jobs={jobs} />
                <PulseInboxCard />
                <PulseTasksCard />
              </div>
            </div>

            {/* Right rail with Pipeline + Activity */}
            <div className="space-y-5">
              <PulsePipelineCard />
              <PulseActivityCard jobs={jobs} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
