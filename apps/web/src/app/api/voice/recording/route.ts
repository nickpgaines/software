import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const TWIML_HEADERS = { "Content-Type": "text/xml" } as const;

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  const callSid = params.get("CallSid") || "";
  const recordingSid = params.get("RecordingSid") || "";
  const recordingUrl = params.get("RecordingUrl") || "";
  const recordingDurationStr = params.get("RecordingDuration") || "";
  const recordingDuration = recordingDurationStr ? Number(recordingDurationStr) : null;

  if (!callSid || !recordingSid) {
    return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
  }

  const db = await getDb();
  await db
    .prepare(
      `UPDATE calls
         SET recording_sid = ?,
             recording_url = ?,
             recording_duration_seconds = ?
       WHERE twilio_call_sid = ?`
    )
    .run(recordingSid, recordingUrl, recordingDuration, callSid);

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
