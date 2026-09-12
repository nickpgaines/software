import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthorizedWidgetSummary,
  type WidgetMetricLoaders,
} from "../src/lib/widget-response.ts";

function recordingLoaders(calls: { metric: string; companyId: number }[]) {
  return {
    async monthlyRevenue(companyId) {
      calls.push({ metric: "monthly", companyId });
      return { total_cents: 100, trend: [] };
    },
    async ytdRevenue(companyId) {
      calls.push({ metric: "ytd", companyId });
      return { total_cents: 200, trend: [] };
    },
    async currentArr(companyId) {
      calls.push({ metric: "arr", companyId });
      return 300;
    },
    async salesLeaderboard(companyId) {
      calls.push({ metric: "sales", companyId });
      return [{ staff_id: 1, name: "Aubrey", revenue_cents: 400, job_count: 2 }];
    },
  } satisfies WidgetMetricLoaders;
}

test("loads and returns only metric sections allowed by current permissions", async () => {
  const calls: { metric: string; companyId: number }[] = [];
  const response = await buildAuthorizedWidgetSummary({
    principal: { tokenId: 1, companyId: 42, staffId: 9 },
    permissions: new Set(["leaderboard.view_sales"]),
    loaders: recordingLoaders(calls),
    now: new Date("2026-08-22T18:00:00.000Z"),
  });

  assert.deepEqual(calls, [{ metric: "sales", companyId: 42 }]);
  assert.equal(response.version, 1);
  assert.equal(response.company_id, 42);
  assert.equal(response.staff_id, 9);
  assert.deepEqual(response.permissions, {
    reports: false,
    sales_leaderboard: true,
  });
  assert.equal(response.metrics.monthly_revenue, null);
  assert.equal(response.metrics.ytd_revenue, null);
  assert.equal(response.metrics.current_arr_cents, null);
  assert.equal(response.metrics.sales_leaderboard?.[0].name, "Aubrey");
});

test("loads all report metrics for reports.view without loading sales", async () => {
  const calls: { metric: string; companyId: number }[] = [];
  const response = await buildAuthorizedWidgetSummary({
    principal: { tokenId: 1, companyId: 42, staffId: 9 },
    permissions: new Set(["reports.view"]),
    loaders: recordingLoaders(calls),
    now: new Date("2026-08-22T18:00:00.000Z"),
  });

  assert.deepEqual(
    new Set(calls.map(({ metric }) => metric)),
    new Set(["monthly", "ytd", "arr"])
  );
  assert.equal(calls.every(({ companyId }) => companyId === 42), true);
  assert.equal(response.metrics.monthly_revenue?.total_cents, 100);
  assert.equal(response.metrics.sales_leaderboard, null);
});
