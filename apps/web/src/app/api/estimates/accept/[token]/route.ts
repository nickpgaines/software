import { NextResponse } from "next/server";
import { getDb, syncReplica, type Estimate } from "@/lib/db";
import {
  buildPromotionalSmsConsentText,
  buildTransactionalSmsConsentText,
} from "@/lib/sms-consent";
import { normalizeUSPhone } from "@/lib/sms";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// Public, token-authed estimate acceptance. The opaque accept_token is the
// credential (no session). Records the signature and, for whichever of the
// two optional consent boxes the customer checked, the SMS consent — each
// with its canonical disclosure text, a timestamp, and the request IP.
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const db = await getDb();
  const lookup = () =>
    db
      .prepare("SELECT * FROM estimates WHERE accept_token = ? LIMIT 1")
      .get(params.token) as Promise<Estimate | undefined>;
  let estimate = await lookup();
  // Embedded-replica miss recovery: this instance's local replica may not have
  // synced the minted accept_token yet. Pull the latest and retry once before
  // 404ing the acceptance. See syncReplica() in @/lib/db.
  if (!estimate) {
    await syncReplica();
    estimate = await lookup();
  }
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    signature_data: string;
    signature_name: string;
    sms_consent: boolean;
    sms_transactional_consent: boolean;
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
  const recordingPromo = body.sms_consent === true && !estimate.sms_consent;
  const recordingTx =
    body.sms_transactional_consent === true &&
    !estimate.sms_transactional_consent;

  let smsConsent = estimate.sms_consent;
  let smsConsentText = estimate.sms_consent_text;
  let smsConsentAt = estimate.sms_consent_at;
  let smsConsentIp = estimate.sms_consent_ip;
  let txConsent = estimate.sms_transactional_consent;
  let txConsentText = estimate.sms_transactional_consent_text;
  let txConsentAt = estimate.sms_transactional_consent_at;
  let txConsentIp = estimate.sms_transactional_consent_ip;

  let businessName: string | null = null;
  let ip: string | null = null;
  if (recordingPromo || recordingTx) {
    const companyRow = await db
      .prepare("SELECT name FROM company WHERE id = ?")
      .get<{ name: string | null }>(estimate.company_id);
    businessName = companyRow?.name || "this business";
    const fwd = req.headers.get("x-forwarded-for");
    ip =
      (fwd ? fwd.split(",")[0]?.trim() : null) ||
      req.headers.get("x-real-ip") ||
      null;
  }
  if (recordingPromo) {
    smsConsent = 1;
    smsConsentText = buildPromotionalSmsConsentText(businessName || "this business");
    smsConsentAt = now;
    smsConsentIp = ip;
  }
  if (recordingTx) {
    txConsent = 1;
    txConsentText = buildTransactionalSmsConsentText(businessName || "this business");
    txConsentAt = now;
    txConsentIp = ip;
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
             sms_transactional_consent = ?, sms_transactional_consent_text = ?,
             sms_transactional_consent_at = ?, sms_transactional_consent_ip = ?,
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
      txConsent,
      txConsentText,
      txConsentAt,
      txConsentIp,
      estimate.id,
      params.token
    );

  if (recordingPromo || recordingTx) {
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

  // Activity: record the approval once (skip on idempotent re-submits of
  // an already-accepted estimate). Best-effort.
  if (estimate.status !== "accepted") {
    try {
      const cust = await db
        .prepare("SELECT name FROM customers WHERE id = ? AND company_id = ?")
        .get<{ name: string | null }>(estimate.customer_id, estimate.company_id);
      await recordActivity(db, estimate.company_id, {
        type: "estimate.approved",
        subjectType: "estimate",
        subjectId: estimate.id,
        subjectLabel: cust?.name || estimate.title || `Estimate #${estimate.id}`,
        actorUserId: estimate.sold_by_id ?? null,
        amountCents: estimate.total_cents,
      });
    } catch {
      // never break the response over a logging failure
    }
  }

  return NextResponse.json({ ok: true });
}
