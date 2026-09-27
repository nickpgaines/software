import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import { calendarDay, resolveSalesRange, salesDays, salesTimestamp, type SalesDate } from "@/lib/sales-report-range";
import { requireCompanyId } from "@/lib/auth";
import { annualCents, withTax } from "@/lib/revenue";

export const dynamic = "force-dynamic";

// Real pin statuses present in the system today (matches map-pin-colors.ts).
const PIN_STATUSES = [
  "sale",
  "not_home",
  "not_interested",
  "not_qualified",
  "do_not_contact",
  "revisit",
  "referral",
  "quote",
] as const;
type PinStatus = (typeof PIN_STATUSES)[number];

// Older rows in the DB carry legacy status keys; normalize on read so they
// land in the right bucket in reports.
const LEGACY_STATUS_MAP: Record<string, PinStatus> = {
  come_back: "revisit",
  quote_sent: "quote",
  do_not_return: "do_not_contact",
};

function normalizeStatus(s: string | null): PinStatus | null {
  if (!s) return null;
  if ((PIN_STATUSES as readonly string[]).includes(s)) return s as PinStatus;
  if (s in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[s];
  return null;
}

type PinRow = { status: string | null; count: number };

type DbHandle = Awaited<ReturnType<typeof getDb>>;

function deltaPct(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return (current - prior) / prior;
}

type Bucket = {
  arr_sold_cents: number;
  arr_sold_count: number;
  one_time_cents: number;
  one_time_count: number;
  pins_added: number;
  pins_quoted: number;
  pins_sale: number;
};

async function getBucket(
  db: DbHandle,
  companyId: number,
  startIso: string,
  endIso: string,
  zone: string,
): Promise<Bucket> {
  // ARR sold = annualized value of subscriptions whose start fell in range.
  const subs =
    ((await db
      .prepare(`SELECT * FROM customer_subscriptions WHERE company_id = ?`)
      .all<CustomerSubscription>(companyId)) as CustomerSubscription[]) || [];

  let arrSold = 0;
  let arrCount = 0;
  for (const s of subs) {
    if (s.status === "pending" || s.status === "declined") continue;
    const startedAt = s.start_date || s.accepted_at || s.created_at;
    const at = startedAt ? salesTimestamp(startedAt, zone).getTime() : NaN;
    if (at >= Date.parse(startIso) && at < Date.parse(endIso)) {
      arrSold += withTax(
        annualCents(s.price_cents, s.interval),
        s.tax_rate_bps,
        true,
      );
      arrCount += 1;
    }
  }

  // One-time revenue sold = sum of non-recurring job prices in range.
  const oneTime = (await db
    .prepare(
      `SELECT COALESCE(SUM(price_cents), 0) AS total, COUNT(*) AS n
         FROM jobs
        WHERE company_id = ?
          AND julianday(scheduled_at) >= julianday(?) AND julianday(scheduled_at) < julianday(?)
          AND COALESCE(recurring, 0) = 0
          AND status != 'cancelled'`,
    )
    .get(companyId, startIso, endIso)) as { total: number; n: number };

  // Pin funnel.
  const pinAgg = (await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'sale' THEN 1 ELSE 0 END) AS sales,
         SUM(CASE WHEN status IN ('sale', 'quote', 'quote_sent') THEN 1 ELSE 0 END) AS quoted
       FROM map_pins
       WHERE company_id = ?
         AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)`,
    )
    .get(companyId, startIso, endIso)) as {
    total: number;
    sales: number;
    quoted: number;
  };

  return {
    arr_sold_cents: Math.round(arrSold),
    arr_sold_count: arrCount,
    one_time_cents: oneTime.total,
    one_time_count: oneTime.n,
    pins_added: pinAgg.total,
    pins_quoted: pinAgg.quoted,
    pins_sale: pinAgg.sales,
  };
}

async function getArrSoldSeries(
  db: DbHandle,
  companyId: number,
  start: SalesDate,
  end: Date,
): Promise<{ date: string; cents: number }[]> {
  const subs =
    ((await db
      .prepare(`SELECT * FROM customer_subscriptions WHERE company_id = ?`)
      .all<CustomerSubscription>(companyId)) as CustomerSubscription[]) || [];
  const days = salesDays(start, end);
  const byDay = new Map<string, number>();
  for (const s of subs) {
    if (s.status === "pending" || s.status === "declined") continue;
    const startedAt = s.start_date || s.accepted_at || s.created_at;
    if (!startedAt) continue;
    const d = salesTimestamp(startedAt, start.timeZone || "UTC");
    if (!(d >= start && d < end)) continue;
    const key = calendarDay(d);
    const arr = withTax(
      annualCents(s.price_cents, s.interval),
      s.tax_rate_bps,
      true,
    );
    byDay.set(key, (byDay.get(key) || 0) + arr);
  }
  return days.map((d) => ({
    date: d.date,
    cents: Math.round(byDay.get(d.date) || 0),
  }));
}

async function getOneTimeSeries(
  db: DbHandle,
  companyId: number,
  start: SalesDate,
  end: Date,
  startIso: string,
  endIso: string,
): Promise<{ date: string; cents: number }[]> {
  const rows = (await db
    .prepare(
      `SELECT scheduled_at AS at, price_cents AS cents
         FROM jobs
        WHERE company_id = ?
          AND julianday(scheduled_at) >= julianday(?) AND julianday(scheduled_at) < julianday(?)
          AND COALESCE(recurring, 0) = 0
          AND status != 'cancelled'`,
    )
    .all(companyId, startIso, endIso)) as { at: string; cents: number }[];
  const days = salesDays(start, end);
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = calendarDay(salesTimestamp(r.at, start.timeZone || "UTC"));
    byDay.set(key, (byDay.get(key) || 0) + r.cents);
  }
  return days.map((d) => ({ date: d.date, cents: byDay.get(d.date) || 0 }));
}

type RepRow = {
  id: number;
  name: string;
  pins: number;
  sales: number;
  conversion_rate: number;
  arr_sold_cents: number;
  one_time_cents: number;
  total_revenue_cents: number;
};

async function getReps(
  db: DbHandle,
  companyId: number,
  startIso: string,
  endIso: string,
  zone: string,
): Promise<RepRow[]> {
  const reps = (await db
    .prepare(
      `SELECT
         s.id AS id,
         s.name AS name,
         (SELECT COUNT(*) FROM map_pins p
            WHERE p.company_id = ?
              AND (LOWER(TRIM(p.created_by)) = LOWER(TRIM(s.name))
                   OR (s.email IS NOT NULL
                       AND LOWER(TRIM(p.created_by)) = LOWER(TRIM(s.email))))
              AND julianday(p.created_at) >= julianday(?) AND julianday(p.created_at) < julianday(?)) AS pins,
         (SELECT COUNT(*) FROM map_pins p
            WHERE p.company_id = ?
              AND (LOWER(TRIM(p.created_by)) = LOWER(TRIM(s.name))
                   OR (s.email IS NOT NULL
                       AND LOWER(TRIM(p.created_by)) = LOWER(TRIM(s.email))))
              AND julianday(p.created_at) >= julianday(?) AND julianday(p.created_at) < julianday(?)
              AND p.status = 'sale') AS sales,
         (SELECT COALESCE(SUM(j.price_cents), 0)
            FROM jobs j
            JOIN job_assignments ja ON ja.job_id = j.id
            WHERE j.company_id = ?
              AND ja.staff_id = s.id AND ja.role = 'sales'
              AND julianday(j.scheduled_at) >= julianday(?) AND julianday(j.scheduled_at) < julianday(?)
              AND COALESCE(j.recurring, 0) = 0
              AND j.status != 'cancelled') AS one_time_cents
       FROM staff s
       WHERE s.company_id = ?`,
    )
    .all(
      companyId,
      startIso,
      endIso,
      companyId,
      startIso,
      endIso,
      companyId,
      startIso,
      endIso,
      companyId,
    )) as {
    id: number;
    name: string;
    pins: number;
    sales: number;
    one_time_cents: number;
  }[];

  // Per-rep ARR sold (subscriptions sold_by_id = s.id, start in range).
  const subs =
    ((await db
      .prepare(`SELECT * FROM customer_subscriptions WHERE company_id = ?`)
      .all<CustomerSubscription>(companyId)) as CustomerSubscription[]) || [];
  const arrByRep = new Map<number, number>();
  for (const s of subs) {
    if (s.status === "pending" || s.status === "declined") continue;
    if (s.sold_by_id == null) continue;
    const startedAt = s.start_date || s.accepted_at || s.created_at;
    if (!startedAt) continue;
    const at = salesTimestamp(startedAt, zone).getTime();
    if (!(at >= Date.parse(startIso) && at < Date.parse(endIso))) continue;
    const arr = withTax(
      annualCents(s.price_cents, s.interval),
      s.tax_rate_bps,
      true,
    );
    arrByRep.set(s.sold_by_id, (arrByRep.get(s.sold_by_id) || 0) + arr);
  }

  return reps
    .map((r) => {
      const arrSold = Math.round(arrByRep.get(r.id) || 0);
      const total = arrSold + r.one_time_cents;
      return {
        id: r.id,
        name: r.name,
        pins: r.pins,
        sales: r.sales,
        conversion_rate: r.pins > 0 ? r.sales / r.pins : 0,
        arr_sold_cents: arrSold,
        one_time_cents: r.one_time_cents,
        total_revenue_cents: total,
      };
    })
    .filter(
      (r) =>
        r.pins > 0 ||
        r.sales > 0 ||
        r.total_revenue_cents > 0 ||
        r.arr_sold_cents > 0,
    )
    .sort((a, b) => b.total_revenue_cents - a.total_revenue_cents);
}

type PinStatusRow = {
  id: number | null;
  name: string;
  total: number;
} & Record<PinStatus, number>;

async function getPinStatusBreakdown(
  db: DbHandle,
  companyId: number,
  startIso: string,
  endIso: string,
): Promise<{
  team_totals: PinStatusRow;
  by_rep: PinStatusRow[];
}> {
  const rows = (await db
    .prepare(
      `SELECT
         s.id AS staff_id,
         COALESCE(s.name, p.created_by, 'Unattributed') AS name,
         p.status AS status,
         COUNT(*) AS n
       FROM map_pins p
       LEFT JOIN staff s
         ON s.company_id = p.company_id
        AND (LOWER(TRIM(s.name)) = LOWER(TRIM(p.created_by))
             OR (s.email IS NOT NULL
                 AND LOWER(TRIM(s.email)) = LOWER(TRIM(p.created_by))))
       WHERE p.company_id = ?
         AND julianday(p.created_at) >= julianday(?) AND julianday(p.created_at) < julianday(?)
       GROUP BY s.id, COALESCE(s.name, p.created_by), p.status`,
    )
    .all(companyId, startIso, endIso)) as {
    staff_id: number | null;
    name: string;
    status: string | null;
    n: number;
  }[];

  function blankRow(name: string, id: number | null): PinStatusRow {
    return {
      id,
      name,
      total: 0,
      sale: 0,
      not_home: 0,
      not_interested: 0,
      not_qualified: 0,
      do_not_contact: 0,
      revisit: 0,
      referral: 0,
      quote: 0,
    };
  }

  const byRep = new Map<string, PinStatusRow>();
  const team = blankRow("Team Totals", null);
  for (const r of rows) {
    const key = r.staff_id == null ? `name:${r.name}` : `id:${r.staff_id}`;
    const row = byRep.get(key) || blankRow(r.name, r.staff_id);
    row.total += r.n;
    team.total += r.n;
    const s = normalizeStatus(r.status);
    if (s) {
      row[s] += r.n;
      team[s] += r.n;
    }
    byRep.set(key, row);
  }

  const sorted = Array.from(byRep.values()).sort((a, b) => b.total - a.total);
  return { team_totals: team, by_rep: sorted };
}

async function getObjectionsBreakdown(
  db: DbHandle,
  companyId: number,
  startIso: string,
  endIso: string,
): Promise<{
  pins_with_objections: number;
  breakdown: { name: string; count: number; pct: number }[];
}> {
  const pins = (await db
    .prepare(
      `SELECT objections
         FROM map_pins
        WHERE company_id = ?
          AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
          AND objections IS NOT NULL`,
    )
    .all(companyId, startIso, endIso)) as { objections: string | null }[];

  const counts = new Map<string, number>();
  let pinsWith = 0;
  for (const p of pins) {
    if (!p.objections) continue;
    let list: string[] = [];
    try {
      const parsed = JSON.parse(p.objections);
      if (Array.isArray(parsed)) list = parsed.filter((v) => typeof v === "string");
    } catch {
      continue;
    }
    if (list.length === 0) continue;
    pinsWith += 1;
    for (const o of list) {
      counts.set(o, (counts.get(o) || 0) + 1);
    }
  }
  const total = pinsWith;
  const breakdown = Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { pins_with_objections: pinsWith, breakdown };
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const url = new URL(req.url);
  let resolved: ReturnType<typeof resolveSalesRange>;
  try { resolved = resolveSalesRange(url); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid date range." }, { status: 400 });
  }
  const db = await getDb();
  const { range, start, end, zone, prior } = resolved;
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const priorStartIso = prior.start.toISOString();
  const priorEndIso = prior.end.toISOString();

  const [
    current,
    priorBucket,
    arrSeries,
    oneTimeSeries,
    reps,
    pinStatus,
    objections,
  ] = await Promise.all([
    getBucket(db, companyId, startIso, endIso, zone),
    getBucket(db, companyId, priorStartIso, priorEndIso, zone),
    getArrSoldSeries(db, companyId, start, end),
    getOneTimeSeries(db, companyId, start, end, startIso, endIso),
    getReps(db, companyId, startIso, endIso, zone),
    getPinStatusBreakdown(db, companyId, startIso, endIso),
    getObjectionsBreakdown(db, companyId, startIso, endIso),
  ]);

  const totalSold = current.arr_sold_cents + current.one_time_cents;
  const priorTotalSold = priorBucket.arr_sold_cents + priorBucket.one_time_cents;
  const dealCount = current.arr_sold_count + current.one_time_count;
  const priorDealCount =
    priorBucket.arr_sold_count + priorBucket.one_time_count;
  const avgDeal = dealCount > 0 ? Math.round(totalSold / dealCount) : 0;
  const priorAvgDeal =
    priorDealCount > 0 ? Math.round(priorTotalSold / priorDealCount) : 0;

  const quoteRate =
    current.pins_added > 0 ? current.pins_quoted / current.pins_added : 0;
  const priorQuoteRate =
    priorBucket.pins_added > 0
      ? priorBucket.pins_quoted / priorBucket.pins_added
      : 0;
  const closeRate =
    current.pins_quoted > 0 ? current.pins_sale / current.pins_quoted : 0;
  const priorCloseRate =
    priorBucket.pins_quoted > 0
      ? priorBucket.pins_sale / priorBucket.pins_quoted
      : 0;
  const convRate =
    current.pins_added > 0 ? current.pins_sale / current.pins_added : 0;
  const priorConvRate =
    priorBucket.pins_added > 0
      ? priorBucket.pins_sale / priorBucket.pins_added
      : 0;

  const arrTotal = arrSeries.reduce((s, p) => s + p.cents, 0);
  const arrAvg =
    arrSeries.length > 0 ? Math.round(arrTotal / arrSeries.length) : 0;
  const otTotal = oneTimeSeries.reduce((s, p) => s + p.cents, 0);
  const otAvg =
    oneTimeSeries.length > 0
      ? Math.round(otTotal / oneTimeSeries.length)
      : 0;

  return NextResponse.json({
    range,
    start: startIso,
    end: endIso,
    revenue_sold: {
      total: {
        cents: totalSold,
        delta_pct: deltaPct(totalSold, priorTotalSold),
      },
      arr_sold: {
        cents: current.arr_sold_cents,
        delta_pct: deltaPct(current.arr_sold_cents, priorBucket.arr_sold_cents),
      },
      one_time: {
        cents: current.one_time_cents,
        delta_pct: deltaPct(current.one_time_cents, priorBucket.one_time_cents),
      },
      avg_deal: {
        cents: avgDeal,
        delta_pct: deltaPct(avgDeal, priorAvgDeal),
      },
    },
    funnel: {
      pins_added: {
        count: current.pins_added,
        delta_pct: deltaPct(current.pins_added, priorBucket.pins_added),
      },
      quote_rate: {
        rate: quoteRate,
        delta_pct: deltaPct(quoteRate, priorQuoteRate),
      },
      close_rate: {
        rate: closeRate,
        delta_pct: deltaPct(closeRate, priorCloseRate),
      },
      conversion_rate: {
        rate: convRate,
        delta_pct: deltaPct(convRate, priorConvRate),
      },
    },
    trends: {
      arr_sold_series: arrSeries,
      one_time_series: oneTimeSeries,
      arr_total_cents: arrTotal,
      arr_avg_cents: arrAvg,
      one_time_total_cents: otTotal,
      one_time_avg_cents: otAvg,
    },
    reps,
    pin_status: pinStatus,
    objections,
  });
}
