import { NextResponse } from "next/server";
import { getDb, type CustomerSubscription } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public endpoint hit from /subscriptions/accept/[token]. No auth — the
// token is the proof of authorization. Captures the customer's signature
// and intent to accept, but does NOT flip the agreement to active. That
// only happens after the card is saved AND the Stripe Subscription is
// created, in PUT /setup-intent. This keeps "active" a strict invariant:
// signed + card on file + Stripe Sub linked.
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
  if (sub.status === "canceled" || sub.status === "declined") {
    return NextResponse.json(
      { error: "Subscription is no longer collectable" },
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

  // Store signature + intent-to-accept. Status stays pending. The PUT
  // setup-intent endpoint flips status to active once the Stripe
  // Subscription is created.
  await db
    .prepare(
      `UPDATE customer_subscriptions
         SET accepted_at = COALESCE(accepted_at, ?),
             signature_data = COALESCE(signature_data, ?),
             signature_name = COALESCE(signature_name, ?),
             signed_at = COALESCE(signed_at, ?)
       WHERE id = ? AND company_id = ?`
    )
    .run(
      now,
      signatureData,
      signatureName,
      now,
      sub.id,
      sub.company_id
    );

  return NextResponse.json({ ok: true });
}
