import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";
import { ensureRecurrenceWindow } from "@/lib/recurrence-schedule";

export const dynamic = "force-dynamic";

// Tops up the rolling one-year visit window for every active subscription and
// every active job recurrence. Intended to run daily. Idempotent: only
// inserts visits to fill the gap between what already exists and the horizon.
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = await getDb();
  const subs = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions WHERE status = 'active'`
    )
    .all()) as CustomerSubscription[];

  let touched = 0;
  for (const s of subs) {
    await ensureRollingVisits(db, {
      subscriptionId: s.id,
      customerId: s.customer_id,
      companyId: s.company_id,
      startDateIso: startDateToIso(s.start_date || s.accepted_at),
      serviceInterval: s.service_interval,
      pricePerVisitCents: s.price_cents,
      visitName: s.name,
      visitDescription: s.description,
      soldById: s.sold_by_id,
      technicianId: null,
    });
    touched += 1;
  }

  const recs = (await db
    .prepare(
      `SELECT id, company_id FROM job_recurrences WHERE status = 'active'`
    )
    .all()) as { id: number; company_id: number }[];

  let recurrencesTopped = 0;
  for (const r of recs) {
    await ensureRecurrenceWindow(db, r.id, r.company_id);
    recurrencesTopped += 1;
  }

  return NextResponse.json({
    ok: true,
    subscriptions_topped_up: touched,
    recurrences_topped_up: recurrencesTopped,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
