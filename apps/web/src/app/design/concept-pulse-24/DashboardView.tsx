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

const GROUP = ["21", "22", "23", "24"];

// P24 — Schedule alone in a tall right rail. The left column carries
// everything else: KPIs, chart, Pipeline, then 3-up of Inbox + Tasks +
// Activity. Schedule shows ~10 rows so it naturally fills the rail height.
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
      <PulsePreviewBar active="24" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-24"
        initials={initials}
        variantLabel="Owner"
        variantSlug="24"
        style="sectioned"
      />

      <main className="ml-60">
        <div className="max-w-[1440px] mx-auto px-10 py-10">
          <PulseHeader
            firstName={firstName}
            jobs={jobs}
            completedCount={completedCount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
            {/* Left column — KPIs, chart, Pipeline, 3-up small widgets */}
            <div className="space-y-5 min-w-0">
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

              <PulsePipelineCard />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PulseInboxCard />
                <PulseTasksCard />
                <PulseActivityCard jobs={jobs} />
              </div>
            </div>

            {/* Right column — Schedule as a tall single card */}
            <div>
              <PulseScheduleCard jobs={jobs} rows={10} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
