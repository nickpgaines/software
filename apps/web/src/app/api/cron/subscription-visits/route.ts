import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";

export const dynamic = "force-dynamic";

// Tops up the rolling visit window for every active subscription.
// Intended to run on a schedule (e.g. daily). Idempotent: only inserts new
// visits when fewer than the window's worth of future visits exist.
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

  return NextResponse.json({ ok: true, subscriptions_topped_up: touched });
}

export async function GET(req: Request) {
  return POST(req);
}
