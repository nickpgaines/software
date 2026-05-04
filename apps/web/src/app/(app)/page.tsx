import {
  getDashboardIdentity,
  getMonthlyRevenue,
  getTodayJobs,
} from "@/lib/dashboard";
import {
  CompactHeroKpi,
  PulseActivityCard,
  PulseChartHero,
  PulseHeader,
  PulseInboxCard,
  PulsePipelineCard,
  PulseScheduleCard,
  PulseTasksCard,
  formatCentsShort,
} from "@/components/pulse/widgets";

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
      <PulseHeader
        firstName={firstName}
        jobs={jobs}
        completedCount={completedCount}
      />

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

      <div className="mb-5">
        <PulseChartHero revenue={revenue} />
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
