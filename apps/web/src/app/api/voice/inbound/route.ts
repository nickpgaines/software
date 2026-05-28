import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { findCompanyByPlatformNumber } from "@/lib/twilio-platform";
import { getAppBaseUrl, getVoiceSettings } from "@/lib/voice";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hangupTwiml(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(
    message
  )}</Say><Hangup/></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  const toNumber = params.get("To") || "";
  const fromNumber = params.get("From") || "";
  const callSid = params.get("CallSid") || "";

  const company = toNumber
    ? await findCompanyByPlatformNumber(toNumber)
    : null;
  if (!company) {
    return hangupTwiml("Sorry, this number is not in service.");
  }

  // Log the inbound call so it shows up in the call history immediately;
  // the status webhook will update status + duration as the call progresses.
  if (callSid) {
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO calls
           (company_id, customer_id, twilio_call_sid, direction, status, from_phone, to_phone, started_at)
         VALUES (?, NULL, ?, 'inbound', 'ringing', ?, ?, datetime('now'))
         ON CONFLICT(twilio_call_sid) DO NOTHING`
      )
      .run(company.id, callSid, fromNumber, toNumber);
  }

  const settings = await getVoiceSettings(company.id);
  const baseUrl = getAppBaseUrl(req);
  const recordingUrl = `${baseUrl}/api/voice/recording`;
  const hasGreeting = !!settings.voice_voicemail_greeting_data_url;

  const greetingElement = hasGreeting
    ? `<Play>${escapeXml(
        `${baseUrl}/api/voice/greeting/${company.id}`
      )}</Play>`
    : `<Say voice="alice">You've reached ${escapeXml(
        company.name || "us"
      )}. Please leave a message after the tone.</Say>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingElement}
  <Record maxLength="180" finishOnKey="#" playBeep="true" trim="trim-silence" recordingStatusCallback="${escapeXml(
    recordingUrl
  )}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"/>
  <Say voice="alice">No message received. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
