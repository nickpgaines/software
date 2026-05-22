import Link from "next/link";
import {
  getDashboardIdentity,
  getDashboardKpis,
  getMonthlyRevenue,
  getTodayJobs,
} from "@/lib/dashboard";
import { getSessionContext } from "@/lib/auth";
import { getCompany, isStripeConfigured } from "@/lib/stripe";
import { loadMe } from "@/lib/me";
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

async function needsStripeConnect(): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  const ctx = await getSessionContext();
  if (!ctx || ctx.isPlatformAdmin) return false;
  try {
    const company = await getCompany(ctx.companyId);
    return !company.stripe_account_id || !company.stripe_charges_enabled;
  } catch {
    return false;
  }
}

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
  const me = await loadMe();
  const role = me?.staff?.permission_level || "admin";
  const isSalesperson = role === "salesperson";
  const isTechnician = role === "technician";
  const salesStaffIdForScope = isSalesperson ? me?.staff?.id ?? null : null;

  const [{ firstName }, jobs, revenue, kpis, showStripeBanner] =
    await Promise.all([
      getDashboardIdentity(),
      getTodayJobs(),
      getMonthlyRevenue(),
      getDashboardKpis({ salesStaffId: salesStaffIdForScope }),
      needsStripeConnect(),
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
        subtitle={
          isTechnician
            ? `${jobs.length} jobs today`
            : `${jobs.length} jobs today · ${completedCount} completed this month`
        }
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

      {showStripeBanner && (
        <Link
          href="/settings?tab=payments"
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-elevated px-4 py-3 text-sm hover:bg-card"
        >
          <span className="flex min-w-0 flex-1 items-start gap-2 text-fg sm:items-center">
            <PulseIcon name="wallet" className="w-4 h-4 mt-0.5 sm:mt-0 shrink-0 text-fg-subtle" />
            <span className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-bold">Connect Stripe to accept payments.</span>
              <span className="text-fg-subtle">
                Invoices can&apos;t be sent until your Stripe account is connected.
              </span>
            </span>
          </span>
          <span className="shrink-0 text-fg-subtle">Set up →</span>
        </Link>
      )}

      {isTechnician ? (
        <>
          {/* Technicians: today's schedule full-width on top, inbox + tasks
              50/50 underneath. No KPI tiles, no revenue chart. */}
          <div className="mb-5">
            <PulseScheduleCard jobs={jobs} rows={8} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PulseInboxCard />
            <PulseTasksCard />
          </div>
        </>
      ) : (
        <>
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
              label={isSalesperson ? "My Jobs Sold" : "Jobs Sold"}
              value={String(kpis.jobsSold)}
              delta={formatCountDelta(kpis.jobsSoldDelta)}
              deltaPositive={kpis.jobsSoldDelta >= 0}
              subLabel="vs last month"
            />
          </div>

          <div className="mb-5">
            <PulseChartHero
              salesStaffId={salesStaffIdForScope}
              titleOverride={isSalesperson ? "My Sales" : undefined}
            />
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
      )}
    </>
  );
}
