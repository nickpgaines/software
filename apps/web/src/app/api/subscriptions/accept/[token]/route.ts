import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";
import {
  ensureRollingVisits,
  startDateToIso,
} from "@/lib/subscription-schedule";
import { firstChargeOnOrAfter } from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";

// Public endpoint hit from /subscriptions/accept/[token]. No auth — the
// token is the proof of authorization. Marks the subscription active,
// stores signature, seeds the rolling visit window.
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const db = await getDb();
  const sub = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE accept_token = ? LIMIT 1"
    )
    .get(params.token)) as CustomerSubscription | undefined;
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sub.status !== "pending") {
    return NextResponse.json(
      { error: "Subscription is no longer pending" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    signature_data: string | null;
    signature_name: string | null;
  }>;

  const signatureData =
    typeof body.signature_data === "string" && body.signature_data.trim()
      ? body.signature_data.trim()
      : null;
  const signatureName =
    typeof body.signature_name === "string" && body.signature_name.trim()
      ? body.signature_name.trim()
      : null;

  if (sub.require_signature && !signatureData) {
    return NextResponse.json(
      { error: "Signature is required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  // First recurring charge lands on the start date (per billing policy); the
  // daily auto-biller takes it from there.
  const nextChargeAt = firstChargeOnOrAfter(
    startDateToIso(sub.start_date || now),
    sub.interval
  );

  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET status = 'active',
             accepted_at = COALESCE(accepted_at, ?),
             signature_data = COALESCE(signature_data, ?),
             signature_name = COALESCE(signature_name, ?),
             signed_at = COALESCE(signed_at, ?),
             next_charge_at = COALESCE(next_charge_at, ?)
       WHERE id = ? AND company_id = ?`
    )
    .run(
      now,
      signatureData,
      signatureName,
      now,
      nextChargeAt,
      sub.id,
      sub.company_id
    );

  await ensureRollingVisits(db, {
    subscriptionId: sub.id,
    customerId: sub.customer_id,
    companyId: sub.company_id,
    startDateIso: startDateToIso(sub.start_date || now),
    serviceInterval: sub.service_interval,
    pricePerVisitCents: sub.price_cents,
    visitName: sub.name,
    visitDescription: sub.description,
    soldById: sub.sold_by_id,
    technicianId: null,
  });

  return NextResponse.json({ ok: true });
}
