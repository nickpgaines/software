import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  const callSid = params.get("CallSid") || "";
  const dialCallSid = params.get("DialCallSid") || "";
  const targetSid = dialCallSid || callSid;
  if (!targetSid) {
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  const status =
    params.get("CallStatus") ||
    params.get("DialCallStatus") ||
    "unknown";
  const durationStr =
    params.get("CallDuration") || params.get("DialCallDuration") || "";
  const duration = durationStr ? Number(durationStr) : null;

  const db = await getDb();

  // Try to update by either the parent CallSid or the DialCallSid -- whichever
  // matches a row we created when the call started.
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
