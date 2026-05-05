"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar } from "../_pulse_chrome";
import { PulseHeader, PulseHeroBody } from "../_pulse_pieces";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

const GROUP = ["17", "18", "19", "20"];

// P17 — max-w-6xl (1152px). Matches P13's width — most margin.
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
      <PulsePreviewBar active="17" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-17"
        initials={initials}
        variantLabel="Owner"
        variantSlug="17"
        style="sectioned"
      />
      <main className="ml-60">
        <div className="max-w-6xl mx-auto px-10 py-10">
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
