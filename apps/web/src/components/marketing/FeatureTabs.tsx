"use client";

/**
 * Tabbed feature panel for the marketing homepage. Left rail lists the
 * primary product surfaces; the right side renders the corresponding
 * showcase. Three are live CRM views imported through `showcase.tsx`
 * (Dashboard, Leaderboard, Scorecards). Map renders via Mapbox Static
 * Images. Scheduling and Payments are hand-rolled static "screenshots"
 * matching the live pages' visual language (the live clients are
 * fetch-bound and too tangled to seed cleanly).
 *
 * Visitors can hover charts and rows inside the live views — those
 * interactions stay; that's the "real product" signal. They cannot
 * fire any handler that would mutate state or navigate.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  KpiRowShowcase,
  LeaderboardShowcase,
  MapShowcase,
  RevenueHeroShowcase,
  ScorecardShowcase,
  TopSalespeopleShowcase,
} from "./showcase";
import { ScheduleScreenshot } from "./screenshots/ScheduleScreenshot";
import { PaymentsScreenshot } from "./screenshots/PaymentsScreenshot";

type FeatureKey =
  | "dashboard"
  | "leaderboard"
  | "scorecards"
  | "map"
  | "scheduling"
  | "payments";

type FeatureMeta = {
  key: FeatureKey;
  label: string;
  blurb: string;
};

const FEATURES: FeatureMeta[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    blurb:
      "Revenue, KPIs, and your top performers — every metric that matters, one screen.",
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    blurb:
      "Live rankings the moment a deal closes. The board your team checks first.",
  },
  {
    key: "scorecards",
    label: "Scorecards",
    blurb:
      "Per-rep performance over any window. Revenue, close rate, reviews — drill into every deal.",
  },
  {
    key: "map",
    label: "Door-knock Map",
    blurb:
      "Drop pins, mark statuses, assign territories. The fastest map in the industry.",
  },
  {
    key: "scheduling",
    label: "Scheduling",
    blurb:
      "Drag-and-drop jobs across the week. Routes, crews, and finished work — visible at a glance.",
  },
  {
    key: "payments",
    label: "Payments",
    blurb:
      "Stripe-powered invoices and subscriptions. Funds land in your account, not ours.",
  },
];

function renderPanel(key: FeatureKey) {
  switch (key) {
    case "dashboard":
      return (
        <div className="space-y-5">
          <KpiRowShowcase />
          <RevenueHeroShowcase />
          <TopSalespeopleShowcase />
        </div>
      );
    case "leaderboard":
      return <LeaderboardShowcase />;
    case "scorecards":
      return <ScorecardShowcase />;
    case "map":
      return <MapShowcase />;
    case "scheduling":
      return <ScheduleScreenshot />;
    case "payments":
      return <PaymentsScreenshot />;
  }
}

export function FeatureTabs() {
  const [active, setActive] = useState<FeatureKey>("dashboard");
  const activeMeta = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      {/* Left rail */}
      <div className="lg:col-span-4">
        <div className="lg:sticky lg:top-24 space-y-2">
          {FEATURES.map((f) => {
            const isActive = f.key === active;
            return (
              <Button
                key={f.key}
                type="button"
                variant="ghost"
                onClick={() => setActive(f.key)}
                className={cn(
                  "w-full h-auto justify-start text-left rounded-2xl px-5 py-4 whitespace-normal block transition-colors",
                  isActive
                    ? "bg-card border border-line"
                    : "border border-transparent hover:bg-card/60 hover:border-line",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors",
                      isActive ? "bg-white" : "bg-zinc-700",
                    )}
                  />
                  <div className="text-[16px] font-extrabold tracking-tight text-white">
                    {f.label}
                  </div>
                </div>
                <p
                  className={cn(
                    "mt-2 ml-4 text-[13px] font-bold leading-relaxed transition-colors",
                    isActive ? "text-zinc-300" : "text-zinc-500",
                  )}
                >
                  {f.blurb}
                </p>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:col-span-8">
        <div className="lg:hidden mb-4 text-[11px] font-extrabold tracking-[0.22em] uppercase text-zinc-500">
          {activeMeta.label}
        </div>
        {renderPanel(active)}
      </div>
    </div>
  );
}
