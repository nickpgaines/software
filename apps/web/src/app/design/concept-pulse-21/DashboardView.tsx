"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar } from "../_pulse_chrome";
import { PulseHeader, PulseHeroBody } from "../_pulse_pieces";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

const GROUP = ["21", "22", "23", "24"];

// P21 — exact P19 baseline at max-w-[1440px]. Nothing on the side; KPIs at
// top, chart, 2-up Schedule + Pipeline, then 3-up Inbox + Tasks + Activity.
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
  return (
    <div style={{ background: PULSE.bg, color: PULSE.text }} className="min-h-screen">
      <PulsePreviewBar active="21" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-21"
        initials={initials}
        variantLabel="Owner"
        variantSlug="21"
        style="sectioned"
      />
      <main className="ml-60">
        <div className="max-w-[1440px] mx-auto px-10 py-10">
          <PulseHeader
            firstName={firstName}
            jobs={jobs}
            completedCount={revenue.jobsCompleted}
          />
          <PulseHeroBody jobs={jobs} revenue={revenue} />
        </div>
      </main>
    </div>
  );
}
