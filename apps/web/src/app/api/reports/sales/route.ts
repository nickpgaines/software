import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolveReportRange } from "@/lib/report-range";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RepRow = {
  id: number;
  name: string;
  doors: number;
  sales: number;
  revenue: number;
};

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const { range, start, end } = resolveReportRange(url.searchParams.get("range"));
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const doors = (await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'sale' THEN 1 ELSE 0 END), 0) AS sales
       FROM map_pins
       WHERE company_id = ?
         AND created_at >= ? AND created_at < ?`
    )
    .get(companyId, startIso, endIso)) as { total: number; sales: number };

  const conversionRate = doors.total > 0 ? doors.sales / doors.total : 0;

  const reps = (await db
    .prepare(
      `SELECT
         s.id,
         s.name,
         (SELECT COUNT(*) FROM map_pins p
            WHERE p.company_id = ?
              AND LOWER(p.created_by) = LOWER(s.name)
              AND p.created_at >= ? AND p.created_at < ?) AS doors,
         (SELECT COUNT(*) FROM map_pins p
            WHERE p.company_id = ?
              AND LOWER(p.created_by) = LOWER(s.name)
              AND p.created_at >= ? AND p.created_at < ?
              AND p.status = 'sale') AS sales,
         (SELECT COALESCE(SUM(j.price_cents), 0)
            FROM jobs j
            JOIN job_assignments ja ON ja.job_id = j.id
            WHERE j.company_id = ?
              AND ja.staff_id = s.id AND ja.role = 'sales'
              AND j.scheduled_at >= ? AND j.scheduled_at < ?) AS revenue
       FROM staff s
       WHERE s.company_id = ?`
    )
    .all(
      companyId, startIso, endIso,
      companyId, startIso, endIso,
      companyId, startIso, endIso,
      companyId
    )) as RepRow[];

  const enriched = reps
    .map((r) => ({
      id: r.id,
      name: r.name,
      doors_knocked: r.doors,
      sales: r.sales,
      conversion_rate: r.doors > 0 ? r.sales / r.doors : 0,
      revenue_cents: r.revenue,
    }))
    .filter((r) => r.doors_knocked > 0 || r.revenue_cents > 0)
    .sort((a, b) => b.revenue_cents - a.revenue_cents);

  return NextResponse.json({
    range,
    start: startIso,
    end: endIso,
    doors: {
      total: doors.total,
      sales: doors.sales,
      conversion_rate: conversionRate,
    },
    reps: enriched,
  });
}
