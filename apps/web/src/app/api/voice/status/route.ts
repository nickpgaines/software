import { NextResponse } from "next/server";
import { getDb, type Lead } from "@/lib/db";
import { fireTrigger } from "@/lib/lead-workflows";
import { normalizeUSPhone } from "@/lib/sms";

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

  // Fire missed_call trigger when an inbound call ended unanswered. Twilio
  // signals this via DialCallStatus on the parent call when the bridge fails
  // to connect, or via CallStatus on a no-answer/busy hangup.
  const isMissed =
    (params.get("DialCallStatus") &&
      ["no-answer", "busy", "failed", "canceled"].includes(
        params.get("DialCallStatus") || ""
      )) ||
    (!params.get("DialCallStatus") &&
      params.get("CallStatus") === "no-answer");
  if (isMissed) {
    const call = await db
      .prepare(
        `SELECT company_id, customer_id, from_phone, direction FROM calls
           WHERE twilio_call_sid = ? LIMIT 1`
      )
      .get<{
        company_id: number | null;
        customer_id: number | null;
        from_phone: string | null;
        direction: string;
      }>(callSid);
    if (call && call.company_id && call.direction === "inbound") {
      const fromNorm =
        normalizeUSPhone(call.from_phone || "") || call.from_phone || "";
      // Find a lead by customer_id or by matching the inbound phone.
      const allLeads = (await db
        .prepare(
          "SELECT id, phone, customer_id FROM leads WHERE company_id = ?"
        )
        .all(call.company_id)) as Pick<
        Lead,
        "id" | "phone" | "customer_id"
      >[];
      const matched = allLeads.filter(
        (l) =>
          (call.customer_id && l.customer_id === call.customer_id) ||
          (l.phone && normalizeUSPhone(l.phone) === fromNorm)
      );
      for (const lead of matched) {
        await fireTrigger({
          companyId: call.company_id,
          leadId: lead.id,
          trigger: "missed_call",
        });
      }
    }
  }

  return new NextResponse(TWIML_OK, { status: 200, headers: TWIML_HEADERS });
}
