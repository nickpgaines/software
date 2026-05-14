import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { advanceRegistration } from "@/lib/sms-registration";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
  const sid = params.BrandSid || params.Sid;
  if (!sid) {
    return new NextResponse("Missing BrandSid", { status: 400 });
  }
  const db = await getDb();
  const row = await db
    .prepare("SELECT id FROM company WHERE twilio_brand_sid = ? LIMIT 1")
    .get<{ id: number }>(sid);
  if (!row) {
    console.warn(`[twilio/brand-status] No tenant found for BrandSid=${sid}`);
    return new NextResponse("Unknown sid", { status: 404 });
  }
  await advanceRegistration(row.id).catch((e) =>
    console.error(`[brand-status] advance failed:`, e)
  );
  return new NextResponse("ok", { status: 200 });
}
