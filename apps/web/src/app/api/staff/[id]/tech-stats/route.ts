import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Range = "today" | "week" | "month" | "year" | "custom";

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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "month") as Range;
  const { start, end } = resolveRange(
    range,
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  const staff = (await db
    .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Staff | undefined;
  if (!staff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Day buckets across the window.
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dayStart = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const dayCount = Math.max(
    1,
    Math.ceil((endDate.getTime() - dayStart.getTime()) / 86_400_000)
  );
  const days: { date: string }[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(dayStart);
    d.setDate(d.getDate() + i);
    days.push({ date: isoDay(d) });
  }

  // Cleans: jobs assigned to this staff as tech in the window.
  const cleanRows = (await db
    .prepare(
      `SELECT j.id AS job_id, j.scheduled_at AS at, j.price_cents AS cents
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.role = 'tech'
       WHERE ja.staff_id = ?
         AND j.company_id = ?
         AND j.scheduled_at >= ? AND j.scheduled_at < ?`
    )
    .all(id, companyId, start, end)) as {
    job_id: number;
    at: string;
    cents: number;
  }[];
  const revenue_cents = cleanRows.reduce((s, r) => s + r.cents, 0);
  const jobs_count = cleanRows.length;
  const revenue_avg_cents =
    jobs_count > 0 ? Math.round(revenue_cents / jobs_count) : 0;

  const cleanByDay = new Map<string, number>();
  for (const r of cleanRows) {
    const k = isoDay(new Date(r.at));
    cleanByDay.set(k, (cleanByDay.get(k) || 0) + r.cents);
  }
  const cleans_series = days.map((d) => ({
    date: d.date,
    cents: cleanByDay.get(d.date) || 0,
  }));

  // Upsells: line_items.upsell = 1 on jobs assigned to this staff as tech.
  const upsellRows =
    cleanRows.length === 0
      ? []
      : ((await db
          .prepare(
            `SELECT li.id AS li_id, li.job_id AS job_id, li.price_cents AS price_cents,
                    li.quantity AS quantity, j.scheduled_at AS at
             FROM line_items li
             JOIN jobs j ON j.id = li.job_id
             JOIN job_assignments ja ON ja.job_id = j.id AND ja.role = 'tech'
             WHERE ja.staff_id = ?
               AND j.company_id = ?
               AND j.scheduled_at >= ? AND j.scheduled_at < ?
               AND li.upsell = 1`
          )
          .all(id, companyId, start, end)) as {
          li_id: number;
          job_id: number;
          price_cents: number;
          quantity: number;
          at: string;
        }[]);

  let upsell_revenue_cents = 0;
  const upsellByDay = new Map<string, number>();
  const visitsUpsold = new Set<number>();
  for (const u of upsellRows) {
    const lineTotal = Math.round(u.price_cents * (u.quantity || 1));
    upsell_revenue_cents += lineTotal;
    const k = isoDay(new Date(u.at));
    upsellByDay.set(k, (upsellByDay.get(k) || 0) + lineTotal);
    visitsUpsold.add(u.job_id);
  }
  const visits_upsold = visitsUpsold.size;
  const upsell_avg_cents =
    upsellRows.length > 0
      ? Math.round(upsell_revenue_cents / upsellRows.length)
      : 0;
  const upsell_series = days.map((d) => ({
    date: d.date,
    cents: upsellByDay.get(d.date) || 0,
  }));

  // Plans signed: subscriptions where this staff is sold_by in window.
  const plansRow = (await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM customer_subscriptions
       WHERE sold_by_id = ?
         AND company_id = ?
         AND created_at >= ? AND created_at < ?
         AND status != 'canceled'`
    )
    .get(id, companyId, start, end)) as { n: number };
  const plans_signed = plansRow.n;

  // Reviews left for this technician in window. Guarded because older
  // deploys may not have run the customer_reviews migration yet — if the
  // table is missing we just report zero reviews instead of 500-ing the
  // whole page.
  let reviewRows: { rating: number; created_at: string }[] = [];
  try {
    reviewRows = (await db
      .prepare(
        `SELECT rating, created_at
         FROM customer_reviews
         WHERE technician_id = ?
           AND company_id = ?
           AND created_at >= ? AND created_at < ?`
      )
      .all(id, companyId, start, end)) as {
      rating: number;
      created_at: string;
    }[];
  } catch {
    reviewRows = [];
  }
  const reviews_count = reviewRows.length;
  const reviews_total = reviewRows.reduce((s, r) => s + (r.rating || 0), 0);
  const avg_rating =
    reviews_count > 0
      ? Math.round((reviews_total / reviews_count) * 10) / 10
      : 0;
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const r of reviewRows) {
    const k = (r.rating as 1 | 2 | 3 | 4 | 5) ?? null;
    if (k && k >= 1 && k <= 5) distribution[k] += 1;
  }
  const reviewsByDay = new Map<string, { sum: number; n: number }>();
  for (const r of reviewRows) {
    const k = isoDay(new Date(r.created_at));
    const cur = reviewsByDay.get(k) || { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    reviewsByDay.set(k, cur);
  }
  // For the chart we surface the daily average rating × 100 (as "cents")
  // so the same HeroChart primitive can render it; the client formats it
  // back to a star value when it shows the headline.
  const review_avg_series = days.map((d) => {
    const r = reviewsByDay.get(d.date);
    const avg = r && r.n > 0 ? r.sum / r.n : 0;
    return { date: d.date, cents: Math.round(avg * 100) };
  });
  const review_count_series = days.map((d) => ({
    date: d.date,
    cents: (reviewsByDay.get(d.date)?.n || 0) * 100,
  }));

  return NextResponse.json({
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      photo_url: staff.photo_url,
    },
    range,
    start,
    end,
    cleans: {
      revenue_cents,
      jobs_count,
      avg_revenue_cents: revenue_avg_cents,
      series: cleans_series,
    },
    upsells: {
      revenue_cents: upsell_revenue_cents,
      avg_cents: upsell_avg_cents,
      plans_signed,
      visits_upsold,
      line_count: upsellRows.length,
      series: upsell_series,
    },
    reviews: {
      count: reviews_count,
      avg_rating,
      distribution,
      avg_series: review_avg_series,
      count_series: review_count_series,
    },
  });
}
