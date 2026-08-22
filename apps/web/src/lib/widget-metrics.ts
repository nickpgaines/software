import type {
  CustomerSubscription,
  Db,
  SubscriptionInterval,
} from "./db.ts";

const INTERVALS_PER_YEAR: Record<SubscriptionInterval, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  triannually: 3,
  semiannually: 2,
  yearly: 1,
};

function monthlyCents(priceCents: number, interval: SubscriptionInterval) {
  return (priceCents * INTERVALS_PER_YEAR[interval]) / 12;
}

function withTax(cents: number, taxBps: number, includeTax: boolean) {
  return includeTax && taxBps ? cents * (1 + taxBps / 10000) : cents;
}

export type RevenueRow = { scheduled_at: string; price_cents: number };
export type WidgetTrendPoint = { date: string; cents: number };
export type WidgetLeaderboardRow = {
  staff_id: number;
  name: string;
  revenue_cents: number;
  job_count: number;
};
export type WidgetRevenueMetric = {
  total_cents: number;
  trend: WidgetTrendPoint[];
};
export type WidgetMetricsSnapshot = {
  monthly_revenue: WidgetRevenueMetric;
  ytd_revenue: WidgetRevenueMetric;
  current_arr_cents: number;
  sales_leaderboard: WidgetLeaderboardRow[];
};

type CurrentMrrRow = Pick<
  CustomerSubscription,
  "status" | "price_cents" | "interval" | "tax_rate_bps" | "canceled_at"
>;

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function dateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

export async function getRevenueRows(
  db: Pick<Db, "prepare">,
  companyId: number,
  start: Date,
  end: Date,
  salesStaffId: number | null = null
): Promise<RevenueRow[]> {
  let sql = `SELECT scheduled_at, price_cents
               FROM jobs
              WHERE company_id = ?
                AND scheduled_at >= ? AND scheduled_at <= ?`;
  const args: (string | number)[] = [
    companyId,
    start.toISOString(),
    end.toISOString(),
  ];
  if (salesStaffId !== null) {
    sql += " AND (sold_by_id = ? OR salesperson_id = ?)";
    args.push(salesStaffId, salesStaffId);
  }
  return db.prepare(sql).all<RevenueRow>(...args);
}

export function sumRevenueRows(rows: RevenueRow[]) {
  return rows.reduce((sum, row) => sum + row.price_cents, 0);
}

function dailyTrend(rows: RevenueRow[], start: Date, end: Date) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = dateKey(new Date(row.scheduled_at));
    totals.set(key, (totals.get(key) || 0) + row.price_cents);
  }
  const result: WidgetTrendPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const final = endOfDay(end);
  while (cursor <= final) {
    const key = dateKey(cursor);
    result.push({ date: key, cents: totals.get(key) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function monthlyTrend(rows: RevenueRow[], year: number) {
  const totals = new Array(12).fill(0) as number[];
  for (const row of rows) {
    const date = new Date(row.scheduled_at);
    if (date.getFullYear() === year) totals[date.getMonth()] += row.price_cents;
  }
  return totals.map((cents, month) => ({
    date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    cents,
  }));
}

export function calculateCurrentMrrCents(
  rows: CurrentMrrRow[],
  options: {
    includeTax: boolean;
    includeRecentCanceled: boolean;
    now: Date;
  }
) {
  const oneMonthAgo = new Date(
    options.now.getFullYear(),
    options.now.getMonth() - 1,
    options.now.getDate()
  ).toISOString();
  const mrr = rows.reduce((sum, row) => {
    const included =
      row.status === "active" ||
      (options.includeRecentCanceled &&
        row.status === "canceled" &&
        !!row.canceled_at &&
        row.canceled_at >= oneMonthAgo);
    if (!included) return sum;
    return (
      sum +
      withTax(
        monthlyCents(row.price_cents, row.interval as SubscriptionInterval),
        row.tax_rate_bps,
        options.includeTax
      )
    );
  }, 0);
  return Math.round(mrr);
}

export async function getCurrentArrCents(
  db: Pick<Db, "prepare">,
  companyId: number,
  now = new Date()
) {
  const rows = await db
    .prepare(
      `SELECT status, price_cents, interval, tax_rate_bps, canceled_at
         FROM customer_subscriptions
        WHERE company_id = ? AND status = 'active'`
    )
    .all<CurrentMrrRow>(companyId);
  return (
    calculateCurrentMrrCents(rows, {
      includeTax: true,
      includeRecentCanceled: false,
      now,
    }) * 12
  );
}

export type LeaderboardQueryRow = {
  id: number;
  name: string;
  role?: string | null;
  permission_level?: string | null;
  photo_url?: string | null;
  color?: string | null;
  revenue_cents: number;
  job_count: number;
  last_sale_at?: string | null;
};

export async function getLeaderboardRows(
  db: Pick<Db, "prepare">,
  companyId: number,
  role: "sales" | "tech",
  start: Date,
  end: Date
): Promise<LeaderboardQueryRow[]> {
  return db
    .prepare(
      `SELECT s.id, s.name, s.role, s.permission_level, s.photo_url, s.color,
              COALESCE(SUM(j.price_cents), 0) AS revenue_cents,
              COUNT(j.id) AS job_count,
              MAX(j.scheduled_at) AS last_sale_at
         FROM staff s
         LEFT JOIN job_assignments ja ON ja.staff_id = s.id AND ja.role = ?
         LEFT JOIN jobs j ON j.id = ja.job_id
          AND j.company_id = ?
          AND j.scheduled_at >= ? AND j.scheduled_at < ?
        WHERE s.company_id = ?
        GROUP BY s.id
        ORDER BY revenue_cents DESC, s.name COLLATE NOCASE ASC`
    )
    .all<LeaderboardQueryRow>(
      role,
      companyId,
      start.toISOString(),
      end.toISOString(),
      companyId
    );
}

export async function getSalesLeaderboard(
  db: Pick<Db, "prepare">,
  companyId: number,
  now = new Date()
): Promise<WidgetLeaderboardRow[]> {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const rows = await getLeaderboardRows(db, companyId, "sales", start, end);
  return rows.slice(0, 3).map((row) => ({
    staff_id: row.id,
    name: row.name,
    revenue_cents: row.revenue_cents,
    job_count: row.job_count,
  }));
}

export async function buildWidgetMetrics(
  db: Db,
  companyId: number,
  now = new Date()
): Promise<WidgetMetricsSnapshot> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  monthEnd.setMilliseconds(monthEnd.getMilliseconds() - 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = endOfDay(now);

  const [monthRows, yearRows, currentArrCents, salesLeaderboard] =
    await Promise.all([
      getRevenueRows(db, companyId, monthStart, monthEnd),
      getRevenueRows(db, companyId, yearStart, yearEnd),
      getCurrentArrCents(db, companyId, now),
      getSalesLeaderboard(db, companyId, now),
    ]);

  return {
    monthly_revenue: {
      total_cents: sumRevenueRows(monthRows),
      trend: dailyTrend(monthRows, monthStart, monthEnd),
    },
    ytd_revenue: {
      total_cents: sumRevenueRows(yearRows),
      trend: monthlyTrend(yearRows, now.getFullYear()),
    },
    current_arr_cents: currentArrCents,
    sales_leaderboard: salesLeaderboard,
  };
}
