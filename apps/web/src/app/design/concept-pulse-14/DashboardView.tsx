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

// P14 — Centered with margin · KPIs BELOW chart · Pipeline + Activity below.
// Header → chart hero → KPI strip → 3-up (Schedule/Inbox/Tasks) →
// 2-up (Pipeline/Activity). Same centered container as P13 but the chart
// leads.
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
      <PulsePreviewBar active="14" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-14"
        initials={initials}
        variantLabel="Owner"
        variantSlug="14"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="max-w-6xl mx-auto px-10 py-10">
          <PulseHeader firstName={firstName} jobs={jobs} completedCount={completedCount} />

          <div className="mb-5">
            <PulseChartHero revenue={revenue} />
          </div>

          {/* KPIs BELOW chart */}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <PulseScheduleCard jobs={jobs} />
            <PulseInboxCard />
            <PulseTasksCard />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PulsePipelineCard />
            <PulseActivityCard jobs={jobs} />
          </div>
        </div>
      </main>
    </div>
  );
}
