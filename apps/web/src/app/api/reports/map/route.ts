import { NextResponse } from "next/server";
import { getDb, type MapPin } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseObjections(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRange(url.searchParams.get("range"));
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const pins = (await db
    .prepare(
      `SELECT * FROM map_pins
       WHERE company_id = ?
         AND created_at >= ? AND created_at < ?`
    )
    .all(companyId, startIso, endIso)) as MapPin[];

  const totalPins = pins.length;
  const sales = pins.filter((p) => p.status === "sale").length;
  const quotes = pins.filter((p) => p.status === "quote_sent").length;
  const notHome = pins.filter((p) => p.status === "not_home").length;
  const answered = totalPins - notHome;

  const conversionRate = totalPins > 0 ? sales / totalPins : 0;
  // "Prospects" = answered doors. Quote rate is quotes / answered.
  const quoteRate = answered > 0 ? quotes / answered : 0;
  // Answer rate = pins flipped away from default not_home.
  const answerRate = totalPins > 0 ? answered / totalPins : 0;

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay));
  const avgPinsPerDay = totalPins / days;

  const objectionCounts = new Map<string, number>();
  let pinsWithObjections = 0;
  for (const p of pins) {
    const list = parseObjections(p.objections);
    if (list.length === 0) continue;
    pinsWithObjections += 1;
    for (const o of list) {
      objectionCounts.set(o, (objectionCounts.get(o) || 0) + 1);
    }
  }
  const objectionsBreakdown = Array.from(objectionCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      pct: pinsWithObjections > 0 ? count / pinsWithObjections : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    range,
    start: startIso,
    end: endIso,
    days,
    pins: {
      total: totalPins,
      sales,
      quotes,
      not_home: notHome,
      answered,
      conversion_rate: conversionRate,
      quote_rate: quoteRate,
      answer_rate: answerRate,
      avg_per_day: avgPinsPerDay,
    },
    objections: {
      pins_with_objections: pinsWithObjections,
      breakdown: objectionsBreakdown,
    },
  });
}
