import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeUSPhone } from "@/lib/sms";
import { getCompanyVoiceStatus } from "@/lib/voice";
import {
  parseCompanyFromVoiceFrom,
  publicBaseUrlFromRequest,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rejectCall(message: string): NextResponse {
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

  // Tenant identification: the caller's identity (issued by /api/voice/token)
  // encodes the company ID as `c<id>_<user>`. Twilio sends this in the From
  // parameter as `client:<identity>` for browser-originated outbound calls.
  const fromParam = params.get("From") || "";
  const companyId = parseCompanyFromVoiceFrom(fromParam);
  if (!companyId) {
    return rejectCall("Sorry, this call could not be placed.");
  }

  const status = await getCompanyVoiceStatus(companyId);
  if (!status.platform_configured || !status.has_number || !status.primary_number) {
    return rejectCall("Sorry, this call could not be placed.");
  }

  const toRaw = params.get("To") || params.get("to") || "";
  const customerIdRaw =
    params.get("customer_id") || params.get("customerId") || "";
  const callSid = params.get("CallSid") || "";

  const to = normalizeUSPhone(toRaw);
  const customerId = Number(customerIdRaw) || null;
  const from = status.primary_number;
  const record = status.record_calls;

  if (!to) {
    return rejectCall("Sorry, this call could not be placed.");
  }

  const db = await getDb();

  let safeCustomerId: number | null = null;
  if (customerId) {
    const cust = await db
      .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
      .get<{ id: number }>(customerId, companyId);
    if (cust) safeCustomerId = customerId;
  }

  if (callSid) {
    await db
      .prepare(
        `INSERT INTO calls
           (company_id, customer_id, twilio_call_sid, direction, status, from_phone, to_phone, started_at)
         VALUES (?, ?, ?, 'outbound', 'initiated', ?, ?, datetime('now'))
         ON CONFLICT(twilio_call_sid) DO UPDATE SET
           customer_id = COALESCE(excluded.customer_id, calls.customer_id),
           to_phone    = excluded.to_phone,
           from_phone  = excluded.from_phone`
      )
      .run(companyId, safeCustomerId, callSid, from, to);
  }

  const base = publicBaseUrlFromRequest(req);
  const statusUrl = `${base}/api/voice/status`;
  const recordingUrl = `${base}/api/voice/recording`;

  const recordAttrs = record
    ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(
        recordingUrl
      )}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(from)}" answerOnBridge="true"${recordAttrs} action="${escapeXml(
    statusUrl
  )}" method="POST">
    <Number statusCallback="${escapeXml(statusUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(
    to
  )}</Number>
  </Dial>
</Response>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
