import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getPlatformTwilioCreds,
  verifyTwilioSignature,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  let creds;
  try {
    creds = getPlatformTwilioCreds();
  } catch {
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
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

  const callSid = params.CallSid || "";
  const dialCallSid = params.DialCallSid || "";
  const targetSid = dialCallSid || callSid;
  if (!targetSid) {
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  const status =
    params.CallStatus || params.DialCallStatus || "unknown";
  const durationStr = params.CallDuration || params.DialCallDuration || "";
  const duration = durationStr ? Number(durationStr) : null;

  const db = await getDb();

  await db
    .prepare(
      `UPDATE calls
         SET status = ?,
             duration_seconds = COALESCE(?, duration_seconds),
             answered_at = CASE
               WHEN answered_at IS NULL AND ? IN ('answered','in-progress')
                 THEN datetime('now') ELSE answered_at END,
             ended_at = CASE
               WHEN ? IN ('completed','busy','failed','no-answer','canceled')
                 THEN datetime('now') ELSE ended_at END
       WHERE twilio_call_sid = ?`
    )
    .run(status, duration, status, status, callSid);

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
