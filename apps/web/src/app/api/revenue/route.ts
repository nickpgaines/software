import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Range =
  | "today"
  | "yesterday"
  | "1w"
  | "4w"
  | "1m"
  | "mtd"
  | "3m"
  | "12m"
  | "qtd"
  | "ytd"
  | "all"
  | "custom"
  | "1y";

// How the daily/hourly series is collapsed into chart points for each range.
type Grain = "hour" | "day" | "5day" | "week" | "month" | "auto";

type SeriesPoint = { date: string; cents: number; label?: string; xLabel?: string };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function resolveRange(
  range: Range,
  customStart: string | null,
  customEnd: string | null,
  earliest: Date | null,
): { start: Date; end: Date; label: string; grain: Grain } {
  const now = new Date();
  const end = endOfDay(now);

  if (range === "custom" && customStart && customEnd) {
    // Parse the YYYY-MM-DD inputs noon-anchored in local time so the range
    // doesn't slip a day earlier for viewers behind UTC (new Date("2026-01-15")
    // is UTC midnight → the prior local day).
    const start = startOfDay(new Date(`${customStart}T12:00:00`));
    const cend = endOfDay(new Date(`${customEnd}T12:00:00`));
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    return {
      start,
      end: cend,
      label: `${fmt(start)} – ${fmt(cend)}`,
      grain: "auto",
    };
  }
  if (range === "today") {
    return { start: startOfDay(now), end, label: "Today", grain: "hour" };
  }
  if (range === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return {
      start: startOfDay(y),
      end: endOfDay(y),
      label: "Yesterday",
      grain: "hour",
    };
  }
  if (range === "1w") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: startOfDay(start), end, label: "Last 7 days", grain: "day" };
  }
  if (range === "4w") {
    const start = new Date(now);
    start.setDate(start.getDate() - 27);
    return {
      start: startOfDay(start),
      end,
      label: "Last 4 weeks",
      grain: "week",
    };
  }
  if (range === "mtd") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: startOfDay(start),
      end,
      label: "Month to date",
      grain: "5day",
    };
  }
  if (range === "3m") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      start: startOfDay(start),
      end,
      label: "Last 3 months",
      grain: "month",
    };
  }
  if (range === "12m") {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return {
      start: startOfDay(start),
      end,
      label: "Last 12 months",
      grain: "month",
    };
  }
  if (range === "qtd") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), q, 1);
    return {
      start: startOfDay(start),
      end,
      label: "Quarter to date",
      grain: "week",
    };
  }
  if (range === "ytd") {
    const start = new Date(now.getFullYear(), 0, 1);
    return {
      start: startOfDay(start),
      end,
      label: `${now.getFullYear()} YTD`,
      grain: "month",
    };
  }
  if (range === "all") {
    const start = earliest
      ? startOfDay(earliest)
      : new Date(now.getFullYear(), 0, 1);
    return { start, end, label: "All time", grain: "auto" };
  }
  if (range === "1y") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end, label: `${now.getFullYear()}`, grain: "month" };
  }
  // "1m" — the whole current calendar month, bucketed into 5-day ranges.
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  monthEnd.setMilliseconds(monthEnd.getMilliseconds() - 1);
  const label =
    start.toLocaleString(undefined, { month: "long", year: "numeric" }) +
    " Revenue";
  return { start, end: monthEnd, label, grain: "5day" };
}

function dateKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Collapse a dense daily line into fixed-size day buckets (e.g. 5-day ranges
// across a month). Each bucket carries a `label` range string for the tooltip;
// the x-axis falls back to the bucket's start day-of-month.
function bucketByDays(
  days: SeriesPoint[],
  size: number,
  maxBuckets: number,
): SeriesPoint[] {
  const buckets: SeriesPoint[] = [];
  for (let b = 0; b < maxBuckets; b++) {
    const startIdx = b * size;
    if (startIdx >= days.length) break;
    // The final bucket absorbs any remainder so the spans stay even.
    const group =
      b === maxBuckets - 1
        ? days.slice(startIdx)
        : days.slice(startIdx, startIdx + size);
    if (group.length === 0) break;
    const cents = group.reduce((a, d) => a + d.cents, 0);
    const s = new Date(`${group[0].date}T12:00:00`);
    const e = new Date(`${group[group.length - 1].date}T12:00:00`);
    const mon = s.toLocaleDateString(undefined, { month: "short" });
    const label =
      s.getDate() === e.getDate()
        ? `${mon} ${s.getDate()}`
        : `${mon} ${s.getDate()}–${e.getDate()}`;
    buckets.push({ date: group[0].date, cents, label });
  }
  return buckets;
}

// One point per calendar month — used by 3M / YTD / 12M / 1Y so the line reads
// as a monthly trend rather than a dense daily spike. x-axis shows the short
// month name (via xLabel, since the point date is always the 1st).
function monthlyBuckets(days: SeriesPoint[]): SeriesPoint[] {
  const order: string[] = [];
  const sums = new Map<string, number>();
  for (const d of days) {
    const key = d.date.slice(0, 7); // YYYY-MM
    if (!sums.has(key)) {
      sums.set(key, 0);
      order.push(key);
    }
    sums.set(key, (sums.get(key) as number) + d.cents);
  }
  return order.map((key) => {
    const dt = new Date(`${key}-01T12:00:00`);
    return {
      date: `${key}-01`,
      cents: sums.get(key) as number,
      label: dt.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      xLabel: dt.toLocaleDateString(undefined, { month: "short" }),
    };
  });
}

// 7-day buckets — used by "Last 4 weeks" and "Quarter to date".
function weeklyBuckets(days: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const group = days.slice(i, i + 7);
    if (group.length === 0) break;
    const cents = group.reduce((a, d) => a + d.cents, 0);
    const s = new Date(`${group[0].date}T12:00:00`);
    const e = new Date(`${group[group.length - 1].date}T12:00:00`);
    const smon = s.toLocaleDateString(undefined, { month: "short" });
    const emon = e.toLocaleDateString(undefined, { month: "short" });
    const label =
      smon === emon
        ? `${smon} ${s.getDate()}–${e.getDate()}`
        : `${smon} ${s.getDate()} – ${emon} ${e.getDate()}`;
    out.push({ date: group[0].date, cents, label });
  }
  return out;
}

// "Custom" / "All time": round to whatever fixed granularity keeps the chart at
// most 12 points — monthly when it spans multiple months, otherwise even day
// buckets.
function autoBuckets(days: SeriesPoint[]): SeriesPoint[] {
  if (days.length <= 12) return days;
  const monthly = monthlyBuckets(days);
  if (monthly.length >= 2 && monthly.length <= 12) return monthly;
  const size = Math.ceil(days.length / 12);
  return bucketByDays(days, size, 12);
}

function hourlySeries(
  rows: { scheduled_at: string; price_cents: number }[],
  day: Date,
): SeriesPoint[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const cents = new Array(24).fill(0) as number[];
  for (const r of rows) {
    const h = new Date(r.scheduled_at).getHours();
    cents[h] += r.price_cents;
  }
  return cents.map((c, h) => {
    const h12 = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? "AM" : "PM";
    return {
      date: `${dateKey(day)}T${pad(h)}:00`,
      cents: c,
      label: `${h12} ${ampm}`,
      xLabel: `${h12}${h < 12 ? "a" : "p"}`,
    };
  });
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "1m") as Range;
  const customStart = url.searchParams.get("start");
  const customEnd = url.searchParams.get("end");
  // Optional: scope revenue to a specific salesperson (sold_by_id). Used by
  // the salesperson dashboard hero to show "My Sales" instead of company
  // revenue.
  const salesStaffId = url.searchParams.get("sales_staff_id");

  let earliest: Date | null = null;
  if (range === "all") {
    const row = (await db
      .prepare(
        `SELECT MIN(scheduled_at) AS min FROM jobs WHERE company_id = ?`,
      )
      .get(companyId)) as { min: string | null } | undefined;
    if (row?.min) earliest = new Date(row.min);
  }

  const { start, end, label, grain } = resolveRange(
    range,
    customStart,
    customEnd,
    earliest,
  );

  let sql = `SELECT scheduled_at, price_cents
             FROM jobs
             WHERE company_id = ?
               AND scheduled_at >= ? AND scheduled_at <= ?`;
  const args: (string | number)[] = [
    companyId,
    start.toISOString(),
    end.toISOString(),
  ];
  if (salesStaffId && /^\d+$/.test(salesStaffId)) {
    sql += ` AND (sold_by_id = ? OR salesperson_id = ?)`;
    args.push(Number(salesStaffId), Number(salesStaffId));
  }
  const rows = (await db.prepare(sql).all(...args)) as {
    scheduled_at: string;
    price_cents: number;
  }[];

  // The headline total/average is the true range total, independent of how the
  // chart series is bucketed below.
  const total = rows.reduce((a, r) => a + r.price_cents, 0);

  let series: SeriesPoint[];
  if (grain === "hour") {
    series = hourlySeries(rows, start);
  } else {
    // Dense daily series first, then collapse per the range's grain.
    const days: SeriesPoint[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push({ date: dateKey(cursor), cents: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    const index = new Map(days.map((d, i) => [d.date, i]));
    for (const r of rows) {
      const i = index.get(dateKey(new Date(r.scheduled_at)));
      if (i !== undefined) days[i].cents += r.price_cents;
    }
    series =
      grain === "month"
        ? monthlyBuckets(days)
        : grain === "week"
          ? weeklyBuckets(days)
          : grain === "5day"
            ? bucketByDays(days, 5, 6)
            : grain === "auto"
              ? autoBuckets(days)
              : days;
  }

  const avg = series.length ? Math.round(total / series.length) : 0;

  return NextResponse.json({
    range,
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    days: series,
    total_cents: total,
    avg_cents: avg,
  });
}
