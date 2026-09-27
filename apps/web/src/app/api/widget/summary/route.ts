import { getDb } from "@/lib/db";
import { authenticateWidgetToken } from "@/lib/widget-auth";
import { handleWidgetSummaryRequest } from "@/lib/widget-http";
import {
  getCurrentArrCents,
  getRevenueMetric,
  getSalesLeaderboard,
} from "@/lib/widget-metrics";
import { loadWidgetPermissions } from "@/lib/widget-permissions";
import { buildAuthorizedWidgetSummary } from "@/lib/widget-response";
import { requireCompanyBillingAccess } from "@/lib/forge-billing/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = await getDb();
  return handleWidgetSummaryRequest(req, {
    authenticate: (token) => authenticateWidgetToken(db, token),
    buildSummary: async (principal) => {
      await requireCompanyBillingAccess(principal.companyId);
      const now = new Date();
      const permissions = await loadWidgetPermissions(db, principal);
      return buildAuthorizedWidgetSummary({
        principal,
        permissions,
        now,
        loaders: {
          monthlyRevenue: (companyId) =>
            getRevenueMetric(db, companyId, "monthly", now),
          ytdRevenue: (companyId) =>
            getRevenueMetric(db, companyId, "ytd", now),
          currentArr: (companyId) => getCurrentArrCents(db, companyId, now),
          salesLeaderboard: (companyId) =>
            getSalesLeaderboard(db, companyId, now),
        },
      });
    },
  });
}
