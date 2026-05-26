import { NextResponse } from "next/server";
import { getDb, type Estimate } from "@/lib/db";
import { buildSmsConsentText } from "@/lib/sms-consent";
import { normalizeUSPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

// Public, token-authed estimate acceptance. The opaque accept_token is the
// credential (no session), so this is reachable by the homeowner from a sent
// link or by the rep on their device at the door. Records the signature and,
// if the customer checked the optional box, the SMS consent — with the
// canonical disclosure text, a timestamp, and the request IP.
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const db = await getDb();
  const estimate = (await db
    .prepare("SELECT * FROM estimates WHERE accept_token = ? LIMIT 1")
    .get(params.token)) as Estimate | undefined;
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    signature_data: string;
    signature_name: string;
    sms_consent: boolean;
  }>;
  const signatureData =
    typeof body.signature_data === "string" && body.signature_data.trim()
      ? body.signature_data.trim()
      : null;
  const signatureName =
    typeof body.signature_name === "string" && body.signature_name.trim()
      ? body.signature_name.trim()
      : null;
  if (!signatureData || !signatureName) {
    return NextResponse.json(
      { error: "A signature and your name are required to accept." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const recordingConsent = body.sms_consent === true && !estimate.sms_consent;
  let smsConsent = estimate.sms_consent;
  let smsConsentText = estimate.sms_consent_text;
  let smsConsentAt = estimate.sms_consent_at;
  let smsConsentIp = estimate.sms_consent_ip;
  if (recordingConsent) {
    const companyRow = await db
      .prepare("SELECT name FROM company WHERE id = ?")
      .get<{ name: string | null }>(estimate.company_id);
    const fwd = req.headers.get("x-forwarded-for");
    smsConsent = 1;
    smsConsentText = buildSmsConsentText(companyRow?.name || "this business");
    smsConsentAt = now;
    smsConsentIp =
      (fwd ? fwd.split(",")[0]?.trim() : null) ||
      req.headers.get("x-real-ip") ||
      null;
  }

  await db
    .prepare(
      `UPDATE estimates
         SET status = 'accepted',
             accepted_at = COALESCE(accepted_at, ?),
             signature_data = ?, signature_name = ?,
             signed_at = COALESCE(signed_at, ?),
             sms_consent = ?, sms_consent_text = ?,
             sms_consent_at = ?, sms_consent_ip = ?,
             updated_at = datetime('now')
       WHERE id = ? AND accept_token = ?`
    )
    .run(
      now,
      signatureData,
      signatureName,
      now,
      smsConsent,
      smsConsentText,
      smsConsentAt,
      smsConsentIp,
      estimate.id,
      params.token
    );

  if (recordingConsent) {
    const cust = await db
      .prepare("SELECT phone FROM customers WHERE id = ? AND company_id = ?")
      .get<{ phone: string | null }>(estimate.customer_id, estimate.company_id);
    const phone = normalizeUSPhone(cust?.phone);
    if (phone) {
      const optRow = await db
        .prepare(
          "SELECT id FROM sms_opt_outs WHERE company_id = ? AND phone = ? LIMIT 1"
        )
        .get<{ id: number }>(estimate.company_id, phone);
      if (optRow) {
        await db
          .prepare(
            `UPDATE sms_opt_outs
                SET opted_out = 0, last_keyword = 'ESTIMATE_CONSENT',
                    opted_in_at = ?, updated_at = datetime('now')
              WHERE id = ?`
          )
          .run(now, optRow.id);
      } else {
        await db
          .prepare(
            `INSERT INTO sms_opt_outs
               (company_id, phone, opted_out, last_keyword, opted_in_at)
             VALUES (?, ?, 0, 'ESTIMATE_CONSENT', ?)`
          )
          .run(estimate.company_id, phone, now);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
