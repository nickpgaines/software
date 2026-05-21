import {
  getDashboardIdentity,
  getDashboardKpis,
  getMonthlyRevenue,
  getTodayJobs,
} from "@/lib/dashboard";
import {
  CompactHeroKpi,
  PulseActivityCard,
  PulseChartHero,
  PulseInboxCard,
  PulsePipelineCard,
  PulseScheduleCard,
  PulseTasksCard,
} from "@/components/pulse/widgets";
import { PageHeader } from "@/components/pulse/PageHeader";
import { PulseIcon } from "@/components/pulse/Icon";
import { PULSE } from "@/components/pulse/theme";
import { Button } from "@/components/ui/button";
import { dateLabel, formatCentsShort, greeting } from "@/components/pulse/format";

export const dynamic = "force-dynamic";

function formatPctDelta(value: number): string {
  const pct = value * 100;
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function formatCountDelta(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value)}`;
}

export default async function DashboardPage() {
  const [{ firstName }, jobs, revenue, kpis] = await Promise.all([
    getDashboardIdentity(),
    getTodayJobs(),
    getMonthlyRevenue(),
    getDashboardKpis(),
  ]);
  const completedCount = revenue.jobsCompleted;

  return (
    <>
      <PageHeader
        kicker={dateLabel()}
        title={
          <>
            {greeting(new Date().getHours())},{" "}
            <span style={{ color: PULSE.violetVar }}>{firstName}.</span>
          </>
        }
        subtitle={`${jobs.length} jobs today · ${completedCount} completed this month`}
        actions={
          <Button
            variant="outline"
            className="h-11 w-72 gap-2 rounded-2xl px-4 text-[13px] bg-elevated border-line text-fg-subtle hover:bg-elevated"
          >
            <PulseIcon name="search" className="w-3.5 h-3.5" />
            Search anything
          </Button>
        }
      />

      <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <CompactHeroKpi
          label="Close Rate"
          value={`${(kpis.closeRate * 100).toFixed(0)}%`}
          delta={formatPctDelta(kpis.closeRateDeltaPp)}
          deltaPositive={kpis.closeRateDeltaPp >= 0}
          subLabel="vs last month"
        />
        <CompactHeroKpi
          label="ARR"
          value={formatCentsShort(kpis.arrCents)}
          delta={formatPctDelta(kpis.arrDeltaPct)}
          deltaPositive={kpis.arrDeltaPct >= 0}
          subLabel="vs last month"
        />
        <CompactHeroKpi
          label="Jobs Sold"
          value={String(kpis.jobsSold)}
          delta={formatCountDelta(kpis.jobsSoldDelta)}
          deltaPositive={kpis.jobsSoldDelta >= 0}
          subLabel="vs last month"
        />
      </div>

      <div className="mb-5">
        <PulseChartHero />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <PulseScheduleCard jobs={jobs} rows={5} />
        <PulsePipelineCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PulseInboxCard />
        <PulseTasksCard />
        <PulseActivityCard jobs={jobs} />
      </div>
    </>
  );
}
