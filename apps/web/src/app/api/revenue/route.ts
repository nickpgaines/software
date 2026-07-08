import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Range = "1w" | "1m" | "3m" | "ytd" | "custom" | "1y";

function resolveRange(
  range: Range,
  customStart: string | null,
  customEnd: string | null,
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (range === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
  }
  if (range === "1w") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfDay, label: "Last 7 days" };
  }
  if (range === "3m") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 2, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfDay, label: "Last 3 months" };
  }
  if (range === "ytd") {
    const start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfDay, label: `${now.getFullYear()} YTD` };
  }
  if (range === "1y") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end: endOfDay, label: `${now.getFullYear()}` };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  const label = start.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  }) + " Revenue";
  return { start, end, label };
}

function dateKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Collapse a month's ~28-31 daily points into ~6 buckets of 5-6 days each
// (Jul 1–5, Jul 6–10, …, Jul 26–31). The daily series is a dense line that
// reads as noise on the small dashboard chart; buckets make the month legible.
// Each bucket carries a `label` range string the chart tooltip surfaces.
function bucketByDays(
  days: { date: string; cents: number }[],
  size: number,
  maxBuckets: number,
): { date: string; cents: number; label: string }[] {
  const buckets: { date: string; cents: number; label: string }[] = [];
  for (let b = 0; b < maxBuckets; b++) {
    const startIdx = b * size;
    if (startIdx >= days.length) break;
    // The final bucket absorbs any remainder so a 31-day month yields six
    // buckets (…, 26–31 = 6 days) rather than a stray one-day seventh.
    const group =
      b === maxBuckets - 1
        ? days.slice(startIdx)
        : days.slice(startIdx, startIdx + size);
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
  const { start, end, label } = resolveRange(range, customStart, customEnd);

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

  const days: { date: string; cents: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({ date: dateKey(cursor), cents: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const index = new Map(days.map((d, i) => [d.date, i]));
  for (const r of rows) {
    const k = dateKey(new Date(r.scheduled_at));
    const i = index.get(k);
    if (i !== undefined) days[i].cents += r.price_cents;
  }

  // Total and per-day average are computed from the raw daily series so the
  // headline stays accurate even when the chart series is bucketed below.
  const total = days.reduce((a, d) => a + d.cents, 0);
  const avg = days.length ? total / days.length : 0;

  // Monthly: bucket the dense daily line into 5-day ranges for legibility.
  const series = range === "1m" ? bucketByDays(days, 5, 6) : days;

  return NextResponse.json({
    range,
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    days: series,
    total_cents: total,
    avg_cents: Math.round(avg),
  });
}
