import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { advanceRegistration } from "@/lib/sms-registration";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
  const sid = params.CampaignSid || params.Sid;
  if (!sid) {
    return new NextResponse("Missing CampaignSid", { status: 400 });
  }
  const db = await getDb();
  const row = await db
    .prepare("SELECT id FROM company WHERE twilio_campaign_sid = ? LIMIT 1")
    .get<{ id: number }>(sid);
  if (!row) {
    console.warn(
      `[twilio/campaign-status] No tenant found for CampaignSid=${sid}`
    );
    return new NextResponse("Unknown sid", { status: 404 });
  }
  await advanceRegistration(row.id).catch((e) =>
    console.error(`[campaign-status] advance failed:`, e)
  );
  return new NextResponse("ok", { status: 200 });
}
