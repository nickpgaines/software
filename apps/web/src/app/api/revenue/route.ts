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

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "1m") as Range;
  const customStart = url.searchParams.get("start");
  const customEnd = url.searchParams.get("end");
  const { start, end, label } = resolveRange(range, customStart, customEnd);

  const rows = (await db
    .prepare(
      `SELECT scheduled_at, price_cents
       FROM jobs
       WHERE company_id = ?
         AND scheduled_at >= ? AND scheduled_at <= ?`
    )
    .all(companyId, start.toISOString(), end.toISOString())) as {
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

  const total = days.reduce((a, d) => a + d.cents, 0);
  const avg = days.length ? total / days.length : 0;

  return NextResponse.json({
    range,
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    days,
    total_cents: total,
    avg_cents: Math.round(avg),
  });
}
