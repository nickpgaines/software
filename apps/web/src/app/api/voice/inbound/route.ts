import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeUSPhone } from "@/lib/sms";
import {
  getPlatformTwilioCreds,
  verifyTwilioSignature,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

function rejectCall(message: string, status = 200): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${message}</Say><Hangup/></Response>`;
  return new NextResponse(xml, { status, headers: TWIML_HEADERS });
}

// Inbound voice webhook for numbers purchased through the platform. For now
// we do not have an in-browser inbound-call experience, so we log the call
// and play a short message. Recording / forwarding can be added later by
// extending the TwiML response.
export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  let creds;
  try {
    creds = getPlatformTwilioCreds();
  } catch {
    return rejectCall("Sorry, this number is not available.", 503);
  }

  const signature = req.headers.get("x-twilio-signature") || "";
  const url = buildPublicUrl(req);
  const valid = verifyTwilioSignature({
    authToken: creds.authToken,
    url,
    params,
    signature,
  });
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const toPhone = params.To || "";
  const fromPhone = params.From || "";
  const callSid = params.CallSid || "";

  const db = await getDb();
  const owner = (await db
    .prepare(
      `SELECT company_id FROM phone_numbers
        WHERE phone_number = ? AND status = 'active' LIMIT 1`
    )
    .get(toPhone)) as { company_id: number } | undefined;
  if (!owner) {
    return rejectCall("Sorry, this number is not in service.");
  }

  if (callSid) {
    await db
      .prepare(
        `INSERT INTO calls
           (company_id, twilio_call_sid, direction, status, from_phone, to_phone, started_at)
         VALUES (?, ?, 'inbound', 'ringing', ?, ?, datetime('now'))
         ON CONFLICT(twilio_call_sid) DO UPDATE SET
           status      = excluded.status,
           from_phone  = excluded.from_phone,
           to_phone    = excluded.to_phone`
      )
      .run(owner.company_id, callSid, normalizeUSPhone(fromPhone) || fromPhone, toPhone);
  }

  // Default behavior: a brief greeting then hang up. Replace with <Dial> to
  // a forwarding number, voicemail, or in-browser client when ready.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thanks for calling. Please send us a text or leave a message after the tone.</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
  return new NextResponse(xml, { status: 200, headers: TWIML_HEADERS });
}
