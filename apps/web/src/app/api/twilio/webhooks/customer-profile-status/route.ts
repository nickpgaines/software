import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { advanceRegistration } from "@/lib/sms-registration";

export const dynamic = "force-dynamic";

// Twilio Trust Hub status callback for both Customer Profile and A2P Trust
// Product. Both resources support an identical StatusCallback parameter; we
// register the same URL for both and dispatch by looking up which SID owns
// the company row.
export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
  const sid = params.Sid || params.CustomerProfileSid || params.TrustProductSid;
  if (!sid) {
    return new NextResponse("Missing Sid", { status: 400 });
  }
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT id FROM company
         WHERE twilio_customer_profile_sid = ?
            OR twilio_trust_product_sid = ?
         LIMIT 1`
    )
    .get<{ id: number }>(sid, sid);
  if (!row) {
    console.warn(
      `[twilio/customer-profile-status] No tenant found for Sid=${sid}`
    );
    return new NextResponse("Unknown sid", { status: 404 });
  }
  await advanceRegistration(row.id).catch((e) =>
    console.error(`[customer-profile-status] advance failed:`, e)
  );
  return new NextResponse("ok", { status: 200 });
}
