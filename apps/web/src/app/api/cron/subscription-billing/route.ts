import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Subscription billing cron — DEPRECATED no-op.
 *
 * Forge subscriptions are now real Stripe Subscriptions; Stripe runs the
 * recurring schedule itself and notifies Forge via the
 * /api/stripe/webhook endpoint. There is no remaining work for an external
 * cron to do here. The route is preserved (rather than deleted) so any
 * existing scheduler still pointed at it gets a clean 200 instead of a
 * 404 alarm.
 *
 * If you're wiring up a NEW Forge instance, do NOT configure a cron against
 * this endpoint. Configure the Stripe webhook instead — see the route header
 * in /api/stripe/webhook/route.ts for the event list.
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({
    ok: true,
    noop: true,
    reason:
      "Subscription billing moved to Stripe Subscriptions; this cron is no longer used.",
  });
}

export async function GET(req: Request) {
  return POST(req);
}
