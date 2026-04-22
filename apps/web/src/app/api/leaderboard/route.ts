import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Range = "today" | "week" | "month" | "year" | "custom" | "all";
type View = "sales" | "tech";

function resolveRange(
  range: Range,
  from?: string | null,
  to?: string | null
): { start: string; end: string } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  if (range === "custom" && from && to) {
    return { start: new Date(from).toISOString(), end: new Date(to).toISOString() };
  }
  if (range === "today") {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 1);
    return { start: startOfDay.toISOString(), end: end.toISOString() };
  }
  if (range === "week") {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 1);
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - 6);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "all") {
    return { start: new Date(0).toISOString(), end: new Date(8640000000000000).toISOString() };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "month") as Range;
  const view = (url.searchParams.get("view") || "sales") as View;
  const fk = view === "tech" ? "j.technician_id" : "j.salesperson_id";

  const { start, end } = resolveRange(
    range,
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.role,
              COALESCE(SUM(j.price_cents), 0) AS revenue_cents,
              COUNT(j.id) AS job_count,
              MAX(j.scheduled_at) AS last_sale_at
       FROM staff s
       LEFT JOIN jobs j ON ${fk} = s.id
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       GROUP BY s.id
       ORDER BY revenue_cents DESC, s.name COLLATE NOCASE ASC`
    )
    .all(start, end) as {
    id: number;
    name: string;
    role: string | null;
    revenue_cents: number;
    job_count: number;
    last_sale_at: string | null;
  }[];

  return NextResponse.json({ range, view, start, end, rows });
}
