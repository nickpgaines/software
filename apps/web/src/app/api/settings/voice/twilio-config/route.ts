import { NextResponse } from "next/server";
import twilio from "twilio";
import { getDb, type Company } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { getVoiceSettings, resolveCallingContext } from "@/lib/voice";

export const dynamic = "force-dynamic";

// Diagnostic-only: returns what Twilio actually has on file for the tenant's
// dedicated number, so we can see whether the voice webhook URL is wired up
// the way we expect. Read-only -- no Twilio config is changed here.
export async function GET() {
  try {
    const companyId = await requireCompanyId();
    const db = await getDb();
    const company = await db
      .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
      .get<Company>(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    const settings = await getVoiceSettings(companyId);
    const ctx = await resolveCallingContext(company, settings);
    if (!ctx.ok) {
      return NextResponse.json(
        {
          error:
            ctx.error ??
            "Could not resolve Twilio account for this tenant's number",
        },
        { status: 400 }
      );
    }
    const client = twilio(ctx.authUsername, ctx.authPassword, {
      accountSid: ctx.accountSid,
    });
    const num = await client
      .incomingPhoneNumbers(ctx.phoneNumberSid)
      .fetch();
    return NextResponse.json({
      account_sid: ctx.accountSid,
      phone_number: num.phoneNumber,
      phone_number_sid: num.sid,
      friendly_name: num.friendlyName,
      voice_url: num.voiceUrl,
      voice_method: num.voiceMethod,
      voice_application_sid: num.voiceApplicationSid,
      sms_url: num.smsUrl,
      sms_method: num.smsMethod,
      status_callback: num.statusCallback,
      capabilities: num.capabilities,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Diagnostic failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
