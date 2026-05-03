import { NextResponse } from "next/server";
import { getDb, type MessagingSettings } from "@/lib/db";
import { normalizeUSPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  // Tenant identification: Twilio sends AccountSid on every webhook. Look up
  // the messaging_settings row that holds it; that row's company_id is the
  // tenant whose Voice SDK app fired this request.
  const accountSid = params.get("AccountSid") || "";
  const db = await getDb();
  const settings = (accountSid
    ? ((await db
        .prepare(
          "SELECT * FROM messaging_settings WHERE account_sid = ? LIMIT 1"
        )
        .get(accountSid)) as MessagingSettings | undefined)
    : undefined);
  if (!settings) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this call could not be placed.</Say><Hangup/></Response>`;
    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
  const companyId = settings.company_id;

  const toRaw = params.get("To") || params.get("to") || "";
  const customerIdRaw = params.get("customer_id") || params.get("customerId") || "";
  const callSid = params.get("CallSid") || "";

  const to = normalizeUSPhone(toRaw);
  const customerId = Number(customerIdRaw) || null;
  const from = settings.from_number;
  const record = settings.voice_record_calls === 1;

  if (!to || !from) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this call could not be placed.</Say><Hangup/></Response>`;
    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // If the caller passed a customer_id, double-check it belongs to this tenant.
  let safeCustomerId: number | null = null;
  if (customerId) {
    const cust = await db
      .prepare("SELECT id FROM customers WHERE id = ? AND company_id = ?")
      .get<{ id: number }>(customerId, companyId);
    if (cust) safeCustomerId = customerId;
  }

  // Log the call as it begins. The status webhook will keep this row updated.
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

  const base = buildPublicUrl(req);
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
