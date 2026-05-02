import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";

export const dynamic = "force-dynamic";

type Range = "today" | "week" | "month" | "year" | "custom";
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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function intervalMultiplier(interval: string): number {
  switch (interval) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "yearly":
      return 1;
    default:
      return 12;
  }
}

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

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "month") as Range;
  const view = (url.searchParams.get("view") || "sales") as View;
  const role = view === "tech" ? "tech" : "sales";
  const { start, end } = resolveRange(
    range,
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  const staff = (await db
    .prepare("SELECT * FROM staff WHERE id = ?")
    .get(id)) as Staff | undefined;
  if (!staff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Subscriptions sold by this staff in window. Count those with sent_at or
  // accepted_at in window — we use created_at as the booking moment.
  const subs = (await db
    .prepare(
      `SELECT id, price_cents, interval, status, created_at
       FROM customer_subscriptions
       WHERE sold_by_id = ?
         AND created_at >= ? AND created_at < ?
         AND status != 'canceled'`
    )
    .all(id, start, end)) as {
    id: number;
    price_cents: number;
    interval: string;
    status: string;
    created_at: string;
  }[];

  let arr_cents = 0;
  for (const s of subs) {
    arr_cents += s.price_cents * intervalMultiplier(s.interval);
  }
  const subs_count = subs.length;
  const sub_avg_cents = subs_count > 0 ? Math.round(arr_cents / subs_count) : 0;

  // One-time cleans: jobs assigned in role in window where job is NOT recurring.
  const oneTime = (await db
    .prepare(
      `SELECT COALESCE(SUM(j.price_cents), 0) AS revenue, COUNT(j.id) AS n
       FROM jobs j
       JOIN job_assignments ja ON ja.job_id = j.id AND ja.role = ?
       WHERE ja.staff_id = ?
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
         AND COALESCE(j.recurring, 0) = 0`
    )
    .get(role, id, start, end)) as { revenue: number; n: number };

  const oneTimeAvg =
    oneTime.n > 0 ? Math.round(oneTime.revenue / oneTime.n) : 0;

  // Pins dropped by this staff (matched by created_by name, like reports/sales).
  const pinRows = (await db
    .prepare(
      `SELECT status, COUNT(*) AS n
       FROM map_pins
       WHERE LOWER(created_by) = LOWER(?)
         AND created_at >= ? AND created_at < ?
       GROUP BY status`
    )
    .all(staff.name, start, end)) as { status: string; n: number }[];

  const pin_counts: Record<PinStatus, number> = {
    sale: 0,
    not_home: 0,
    not_interested: 0,
    not_qualified: 0,
    do_not_contact: 0,
    revisit: 0,
    referral: 0,
    quote: 0,
  };
  let pin_total = 0;
  for (const r of pinRows) {
    pin_total += r.n;
    if ((PIN_STATUSES as readonly string[]).includes(r.status)) {
      pin_counts[r.status as PinStatus] = r.n;
    }
  }
  // "Qualified" pins for conversion rate = those that engaged (everything
  // except not_home and do_not_contact).
  const qualified =
    pin_total - pin_counts.not_home - pin_counts.do_not_contact;
  const conversion_rate = qualified > 0 ? pin_counts.sale / qualified : 0;

  return NextResponse.json({
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      photo_url: staff.photo_url,
    },
    range,
    view,
    start,
    end,
    subscriptions: {
      arr_cents,
      count: subs_count,
      avg_value_cents: sub_avg_cents,
    },
    one_time: {
      revenue_cents: oneTime.revenue,
      count: oneTime.n,
      avg_value_cents: oneTimeAvg,
    },
    pins: {
      total: pin_total,
      qualified,
      counts: pin_counts,
      conversion_rate,
    },
  });
}
