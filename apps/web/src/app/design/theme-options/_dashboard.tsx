/**
 * Server component that renders the exact production dashboard widgets used
 * at `/`. Mirrors `(app)/page.tsx` so each preview option shows the real
 * scrollable, interactive dashboard — not a static mock. Imported from each
 * option route under /design/theme-options/option-N.
 *
 * The single deviation from `(app)/page.tsx` is the `accentName` flag, which
 * wraps the user's first name in the greeting in a span the preview shell
 * can recolor via CSS (`[data-accent-name="true"] [data-name-token]`).
 */

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
import { Button } from "@/components/ui/button";
import {
  dateLabel,
  formatCentsShort,
  greeting,
} from "@/components/pulse/format";

export async function DashboardContent({
  accentName = false,
}: {
  accentName?: boolean;
} = {}) {
  const [{ firstName }, jobs, revenue] = await Promise.all([
    getDashboardIdentity(),
    getTodayJobs(),
    getMonthlyRevenue(),
  ]);
  const completedCount = revenue.jobsCompleted;
  const closeRate = 0.34;
  const arrCents = revenue.totalCents * 12;
  const jobsSold = completedCount + jobs.length;

  const greetingText = `${greeting(new Date().getHours())}, `;
  const title = accentName ? (
    <>
      {greetingText}
      <span data-name-token>{firstName}</span>.
    </>
  ) : (
    `${greetingText}${firstName}.`
  );

  return (
    <>
      <PageHeader
        kicker={dateLabel()}
        title={title}
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
