import {
  getDashboardIdentity,
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

export default async function DashboardPage() {
  const [{ firstName }, jobs, revenue] = await Promise.all([
    getDashboardIdentity(),
    getTodayJobs(),
    getMonthlyRevenue(),
  ]);
  const completedCount = revenue.jobsCompleted;
  const closeRate = 0.34;
  const arrCents = revenue.totalCents * 12;
  const jobsSold = completedCount + jobs.length;

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <CompactHeroKpi
          label="Close Rate"
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
          label="Jobs Sold"
          value={String(jobsSold)}
          delta="+12"
          deltaPositive
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
