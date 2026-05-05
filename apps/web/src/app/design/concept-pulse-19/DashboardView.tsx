"use client";

import { PULSE } from "../_pulse_theme";
import { PulseSidebar, PulsePreviewBar } from "../_pulse_chrome";
import { PulseHeader, PulseHeroBody } from "../_pulse_pieces";
import type { LiveJob, RevenueSummary } from "../concept-live/_data";

const GROUP = ["17", "18", "19", "20"];

// P19 — max-w-[1440px]. Two steps wider than P17, just shy of full bleed.
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
      <PulsePreviewBar active="19" group={GROUP} />
      <PulseSidebar
        homeSlug="concept-pulse-19"
        initials={initials}
        variantLabel="Owner"
        variantSlug="19"
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
