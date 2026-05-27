import { NextResponse } from "next/server";
import { runDueSubscriptionCharges } from "@/lib/subscription-billing";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Charges every active, auto-billing subscription whose next charge is due,
// and retries past-due ones (throttled). Intended to run daily. Idempotent:
// a billing period that already has a succeeded charge is never charged twice.
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Stripe is not configured" },
      { status: 503 }
    );
  }
  const result = await runDueSubscriptionCharges();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
