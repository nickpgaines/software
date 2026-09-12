import assert from "node:assert/strict";
import test from "node:test";
import type { Db, Stmt } from "../src/lib/db.ts";
import {
  buildWidgetMetrics,
  calculateCurrentMrrCents,
  getCurrentArrCents,
  getRevenueMetric,
} from "../src/lib/widget-metrics.ts";

function metricsDb() {
  const queries: { sql: string; args: unknown[] }[] = [];
  let jobsCall = 0;
  const db = {
    prepare(sql: string) {
      return {
        async get() {
          return undefined;
        },
        async all(...args: unknown[]) {
          queries.push({ sql, args });
          if (sql.includes("FROM jobs") && !sql.includes("job_assignments")) {
            jobsCall += 1;
            return jobsCall === 1
              ? [
                  { scheduled_at: "2026-08-03T15:00:00.000Z", price_cents: 990200 },
                ]
              : [
                  { scheduled_at: "2026-01-10T15:00:00.000Z", price_cents: 3829800 },
                  { scheduled_at: "2026-08-03T15:00:00.000Z", price_cents: 990200 },
                ];
          }
          if (sql.includes("customer_subscriptions")) {
            return [
              {
                status: "active",
                price_cents: 10000,
                interval: "monthly",
                tax_rate_bps: 0,
                canceled_at: null,
              },
            ];
          }
          if (sql.includes("job_assignments")) {
            return [
              { id: 1, name: "Aubrey", revenue_cents: 800000, job_count: 8 },
              { id: 2, name: "Jack", revenue_cents: 600000, job_count: 7 },
              { id: 3, name: "David", revenue_cents: 500000, job_count: 5 },
              { id: 4, name: "Zoe", revenue_cents: 100000, job_count: 2 },
            ];
          }
          return [];
        },
        async run() {
          return { changes: 0, lastInsertRowid: 0 };
        },
      } as Stmt;
    },
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(this as Db);
    },
  } as Db;
  return { db, queries };
}

test("builds all widget metrics from tenant-scoped shared definitions", async () => {
  const { db, queries } = metricsDb();
  const snapshot = await buildWidgetMetrics(
    db,
    42,
    new Date("2026-08-22T18:00:00.000Z")
  );

  assert.equal(snapshot.monthly_revenue.total_cents, 990200);
  assert.equal(snapshot.ytd_revenue.total_cents, 4820000);
  assert.equal(snapshot.current_arr_cents, 120000);
  assert.deepEqual(
    snapshot.sales_leaderboard.map((row) => row.name),
    ["Aubrey", "Jack", "David"]
  );
  assert.equal(
    queries.every(
      ({ sql, args }) => sql.includes("company_id") && args.includes(42)
    ),
    true
  );
});

test("current MRR includes only active subscriptions for the widget", () => {
  const mrr = calculateCurrentMrrCents(
    [
      { status: "active", price_cents: 120000, interval: "yearly", tax_rate_bps: 0, canceled_at: null },
      { status: "canceled", price_cents: 5000, interval: "monthly", tax_rate_bps: 0, canceled_at: "2026-08-20" },
      { status: "pending", price_cents: 9000, interval: "monthly", tax_rate_bps: 0, canceled_at: null },
    ],
    { includeTax: true, includeRecentCanceled: false, now: new Date("2026-08-22T18:00:00Z") }
  );
  assert.equal(mrr, 10000);
});

test("widget ARR matches report defaults for tax and recent paid cancellations", async () => {
  const rows = [
    {
      status: "active",
      price_cents: 10000,
      interval: "monthly",
      tax_rate_bps: 500,
      canceled_at: null,
    },
    {
      status: "canceled",
      price_cents: 5000,
      interval: "monthly",
      tax_rate_bps: 1000,
      canceled_at: "2026-08-01T00:00:00.000Z",
    },
    {
      status: "canceled",
      price_cents: 7000,
      interval: "monthly",
      tax_rate_bps: 0,
      canceled_at: "2026-07-01T00:00:00.000Z",
    },
  ];
  let subscriptionSql = "";
  const db = {
    prepare(sql: string) {
      subscriptionSql = sql;
      return {
        async all() {
          return rows;
        },
      } as Stmt;
    },
  } as Pick<Db, "prepare">;
  const now = new Date("2026-08-22T18:00:00.000Z");

  const arr = await getCurrentArrCents(db, 42, now);
  const reportDefaultMrr = calculateCurrentMrrCents(rows, {
    includeTax: true,
    includeRecentCanceled: true,
    now,
  });

  assert.equal(arr, 192000);
  assert.equal(arr, reportDefaultMrr * 12);
  assert.match(subscriptionSql, /status IN \('active', 'canceled'\)/);
});

test("loads one requested revenue metric without computing other sections", async () => {
  const { db, queries } = metricsDb();
  const metric = await getRevenueMetric(
    db,
    42,
    "monthly",
    new Date("2026-08-22T18:00:00.000Z")
  );
  assert.equal(metric.total_cents, 990200);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /FROM jobs/);
});
