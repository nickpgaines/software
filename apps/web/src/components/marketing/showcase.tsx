"use client";

/**
 * Marketing-site showcase widgets. Each widget here is a thin wrapper that
 * imports a live CRM view component and feeds it seeded demo data — the
 * marketing page renders the EXACT same React components the dashboard
 * does. View components are split out of their stateful clients in:
 *
 *   - `pulse/widgets.tsx`               → `RevenueHeroView`, `CompactHeroKpi`
 *   - `reports/RevenueBarChart.tsx`     → `RevenueBarChart`
 *   - `leaderboard/LeaderboardRankingsView.tsx`
 *   - `tech-stats/ScorecardView.tsx`
 *
 * Optional event handlers (onRangeChange, onRowClick, etc.) are omitted
 * here so the controls render but stay inert — visitors can hover charts
 * and rows the same way they would in the app, but no state mutates.
 */

import { CompactHeroKpi, RevenueHeroView } from "@/components/pulse/widgets";
import { PULSE } from "@/components/pulse/theme";
import { RevenueBarChart } from "@/components/reports/RevenueBarChart";
import {
  LeaderboardRankingsView,
  type Row,
} from "@/components/leaderboard/LeaderboardRankingsView";
import {
  ScorecardView,
  type TechStats,
} from "@/components/tech-stats/ScorecardView";
import { MapMarketing } from "@/components/marketing/MapMarketing";

/* ---------- Seeded demo data ------------------------------------------ */

// 30 days of revenue with a believable upward trend + daily noise. Cents,
// dated using the current month so the chart's axis labels look live.
function seededRevenueDays(): { date: string; cents: number }[] {
  const today = new Date();
  const days: { date: string; cents: number }[] = [];
  // Deterministic pseudo-noise so SSR + hydrate match.
  let seed = 17;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const base = 100_000 + ((29 - i) / 29) * 220_000;
    const noise = (rand() - 0.5) * base * 0.7;
    const cents = Math.max(20_000, Math.round(base + noise));
    days.push({ date: iso, cents });
  }
  return days;
}

const DEMO_DAYS = seededRevenueDays();
const DEMO_TOTAL_CENTS = DEMO_DAYS.reduce((s, d) => s + d.cents, 0);

const DEMO_BARCHART = [
  { name: "Marcus B.", revenue_cents: 9_820_00 },
  { name: "Avery C.", revenue_cents: 9_010_00 },
  { name: "Jordan R.", revenue_cents: 7_640_00 },
  { name: "Samira P.", revenue_cents: 5_820_00 },
  { name: "Tyler B.", revenue_cents: 5_610_00 },
];
const DEMO_BARCHART_AVG_DOLLARS = Math.round(
  DEMO_BARCHART.reduce((s, r) => s + r.revenue_cents, 0) /
    DEMO_BARCHART.length /
    100,
);

// Leaderboard rows — shape matches `Row` from LeaderboardRankingsView.
const DEMO_LEADERBOARD_ROWS: Row[] = [
  {
    id: 1,
    name: "Marcus Bennett",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 9_820_00,
    job_count: 41,
    last_sale_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Avery Chen",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 9_010_00,
    job_count: 38,
    last_sale_at: new Date().toISOString(),
  },
  {
    id: 3,
    name: "Jordan Reyes",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 7_640_00,
    job_count: 32,
    last_sale_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 4,
    name: "Samira Patel",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 5_820_00,
    job_count: 27,
    last_sale_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 5,
    name: "Tyler Brooks",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 5_610_00,
    job_count: 25,
    last_sale_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: 6,
    name: "Riley Morgan",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 4_980_00,
    job_count: 22,
    last_sale_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: 7,
    name: "Dakota Lee",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 4_210_00,
    job_count: 19,
    last_sale_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  },
  {
    id: 8,
    name: "Casey Nguyen",
    role: "Sales",
    photo_url: null,
    color: null,
    revenue_cents: 3_880_00,
    job_count: 17,
    last_sale_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
];

const DEMO_LEADERBOARD_TOTAL = DEMO_LEADERBOARD_ROWS.reduce(
  (s, r) => s + r.revenue_cents,
  0,
);
const DEMO_LEADERBOARD_TOTAL_JOBS = DEMO_LEADERBOARD_ROWS.reduce(
  (s, r) => s + r.job_count,
  0,
);

// Tech-stats payload — shape matches `TechStats` from ScorecardView.
// Uses the seeded daily revenue as the cleans series so the embedded
// charts look believable.
const DEMO_TECH_STATS: TechStats = {
  staff: {
    id: 1,
    name: "Avery Chen",
    role: "Technician",
    photo_url: null,
  },
  range: "month",
  start: DEMO_DAYS[0].date,
  end: DEMO_DAYS[DEMO_DAYS.length - 1].date,
  cleans: {
    revenue_cents: DEMO_TOTAL_CENTS,
    jobs_count: 64,
    avg_revenue_cents: Math.round(DEMO_TOTAL_CENTS / 64),
    series: DEMO_DAYS,
  },
  upsells: {
    revenue_cents: 184_500_00,
    avg_cents: 28_846,
    plans_signed: 12,
    visits_upsold: 41,
    line_count: 64,
    series: DEMO_DAYS.map((d) => ({
      date: d.date,
      cents: Math.round(d.cents * 0.18),
    })),
  },
  reviews: {
    count: 38,
    avg_rating: 4.7,
    distribution: { "1": 0, "2": 1, "3": 2, "4": 6, "5": 29 },
    avg_series: DEMO_DAYS.map((d, i) => ({
      date: d.date,
      cents: 470 - (i % 5),
    })),
    count_series: DEMO_DAYS.map((d, i) => ({
      date: d.date,
      cents: 1 + (i % 3),
    })),
  },
};

/* ---------- KPI row (real CompactHeroKpi) ----------------------------- */

export function KpiRowShowcase() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <CompactHeroKpi
        label="Close Rate"
        value="68%"
        delta="+4.2%"
        deltaPositive
        subLabel="vs last month"
      />
      <CompactHeroKpi
        label="ARR"
        value="$284k"
        delta="+12.8%"
        deltaPositive
        subLabel="vs last month"
      />
      <CompactHeroKpi
        label="Jobs Sold"
        value="142"
        delta="+18"
        deltaPositive
        subLabel="vs last month"
      />
    </div>
  );
}

/* ---------- Revenue chart hero (real RevenueHeroView) ----------------- */

export function RevenueHeroShowcase() {
  const titleLabel = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <RevenueHeroView
      days={DEMO_DAYS}
      totalCents={DEMO_TOTAL_CENTS}
      label={titleLabel}
      range="1m"
      height={260}
    />
  );
}

/* ---------- Top Salespeople (real RevenueBarChart) -------------------- */

export function TopSalespeopleShowcase() {
  return (
    <section
      className="rounded-2xl p-6 md:p-7"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div className="text-[14px] font-semibold mb-4 text-zinc-500">
        Top Salespeople ·{" "}
        {new Date().toLocaleString(undefined, { month: "long" })}
      </div>
      <RevenueBarChart
        data={DEMO_BARCHART}
        color="#3b82f6"
        averageDollars={DEMO_BARCHART_AVG_DOLLARS}
        tooltipLabel="Revenue Sold"
      />
    </section>
  );
}

/* ---------- Leaderboard (real LeaderboardRankingsView) ---------------- */

export function LeaderboardShowcase() {
  return (
    <LeaderboardRankingsView
      view="sales"
      range="month"
      rows={DEMO_LEADERBOARD_ROWS}
      total={DEMO_LEADERBOARD_TOTAL}
      totalJobs={DEMO_LEADERBOARD_TOTAL_JOBS}
      topName={DEMO_LEADERBOARD_ROWS[0].name}
      mounted
    />
  );
}

/* ---------- Scorecard (real ScorecardView) ---------------------------- */

export function ScorecardShowcase() {
  return (
    <ScorecardView
      staff={DEMO_TECH_STATS.staff}
      data={DEMO_TECH_STATS}
      range="month"
      hideNav
    />
  );
}

/* ---------- Map (Mapbox satellite-streets-v12 static image) ----------- */

export function MapShowcase() {
  return <MapMarketing />;
}
