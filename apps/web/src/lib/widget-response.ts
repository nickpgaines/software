import type { WidgetPrincipal } from "./widget-auth.ts";
import type {
  WidgetLeaderboardRow,
  WidgetRevenueMetric,
} from "./widget-metrics.ts";

export type WidgetSummaryResponse = {
  version: 1;
  company_id: number;
  staff_id: number;
  updated_at: string;
  permissions: {
    reports: boolean;
    sales_leaderboard: boolean;
  };
  metrics: {
    monthly_revenue: WidgetRevenueMetric | null;
    ytd_revenue: WidgetRevenueMetric | null;
    current_arr_cents: number | null;
    sales_leaderboard: WidgetLeaderboardRow[] | null;
  };
};

export type WidgetMetricLoaders = {
  monthlyRevenue(companyId: number): Promise<WidgetRevenueMetric>;
  ytdRevenue(companyId: number): Promise<WidgetRevenueMetric>;
  currentArr(companyId: number): Promise<number>;
  salesLeaderboard(companyId: number): Promise<WidgetLeaderboardRow[]>;
};

export async function buildAuthorizedWidgetSummary(input: {
  principal: WidgetPrincipal;
  permissions: ReadonlySet<string>;
  loaders: WidgetMetricLoaders;
  now?: Date;
}): Promise<WidgetSummaryResponse> {
  const canSeeReports = input.permissions.has("reports.view");
  const canSeeSales = input.permissions.has("leaderboard.view_sales");
  const reportMetrics = canSeeReports
    ? await Promise.all([
        input.loaders.monthlyRevenue(input.principal.companyId),
        input.loaders.ytdRevenue(input.principal.companyId),
        input.loaders.currentArr(input.principal.companyId),
      ])
    : null;
  const salesLeaderboard = canSeeSales
    ? await input.loaders.salesLeaderboard(input.principal.companyId)
    : null;

  return {
    version: 1,
    company_id: input.principal.companyId,
    staff_id: input.principal.staffId,
    updated_at: (input.now ?? new Date()).toISOString(),
    permissions: {
      reports: canSeeReports,
      sales_leaderboard: canSeeSales,
    },
    metrics: {
      monthly_revenue: reportMetrics?.[0] ?? null,
      ytd_revenue: reportMetrics?.[1] ?? null,
      current_arr_cents: reportMetrics?.[2] ?? null,
      sales_leaderboard: salesLeaderboard,
    },
  };
}
