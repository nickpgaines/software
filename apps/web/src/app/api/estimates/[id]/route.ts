import { NextResponse } from "next/server";
import {
  getDb,
  type Estimate,
  type EstimateItem,
  type EstimateStatus,
} from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  buildPromotionalSmsConsentText,
  buildTransactionalSmsConsentText,
} from "@/lib/sms-consent";
import { normalizeUSPhone } from "@/lib/sms";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

const VALID_STATUSES: EstimateStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "canceled",
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const estimate = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Estimate | undefined;
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = (await db
    .prepare(
      "SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY position ASC, id ASC"
    )
    .all(id)) as EstimateItem[];
  let sold_by_name: string | null = null;
  if (estimate.sold_by_id != null) {
    const s = await db
      .prepare("SELECT name FROM staff WHERE id = ?")
      .get<{ name: string }>(estimate.sold_by_id);
    sold_by_name = s?.name ?? null;
  }
  // Ensure an opaque accept token exists so the detail page can link to the
  // public signature/acceptance page (rep's device in person, or sent link).
  // Best-effort: minting the token must never break loading the estimate. A DB
  // that hasn't run the accept_token migration yet simply renders without the
  // Signature Page link until it has.
  let acceptToken = estimate.accept_token ?? null;
  if (!acceptToken) {
    try {
      const minted = randomBytes(24).toString("base64url");
      await db
        .prepare(
          "UPDATE estimates SET accept_token = ? WHERE id = ? AND company_id = ?"
        )
        .run(minted, id, ctx.companyId);
      acceptToken = minted;
    } catch (e) {
      console.warn(
        "[estimates] could not mint accept_token:",
        (e as Error).message
      );
      acceptToken = null;
    }
  }
  return NextResponse.json({
    ...estimate,
    accept_token: acceptToken,
    items,
    sold_by_name,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Estimate | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: EstimateStatus;
    signature_data: string;
    signature_name: string;
    terms: string;
    sms_consent: boolean;
    sms_transactional_consent: boolean;
  }>;
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const acceptedAt =
    body.status === "accepted"
      ? existing.accepted_at || now
      : existing.accepted_at;
  const declinedAt =
    body.status === "declined"
      ? existing.declined_at || now
      : existing.declined_at;
  const signatureData =
    typeof body.signature_data === "string" && body.signature_data.trim()
      ? body.signature_data.trim()
      : existing.signature_data;
  const signatureName =
    typeof body.signature_name === "string" && body.signature_name.trim()
      ? body.signature_name.trim()
      : existing.signature_name;
  const signedAt = signatureData
    ? existing.signed_at || now
    : existing.signed_at;

  const terms = typeof body.terms === "string" ? body.terms : existing.terms;

  // SMS consent is recorded once per type, server-side, with the canonical
  // disclosure text (never trust client-supplied copy) plus a timestamp and
  // the request IP — the auditable record a carrier asks for to verify the
  // opt-in CTA. Promotional and transactional consent are tracked separately,
  // each via its own checkbox.
  const recordingPromo = body.sms_consent === true && !existing.sms_consent;
  const recordingTx =
    body.sms_transactional_consent === true &&
    !existing.sms_transactional_consent;
  let smsConsent = existing.sms_consent;
  let smsConsentText = existing.sms_consent_text;
  let smsConsentAt = existing.sms_consent_at;
  let smsConsentIp = existing.sms_consent_ip;
  let txConsent = existing.sms_transactional_consent;
  let txConsentText = existing.sms_transactional_consent_text;
  let txConsentAt = existing.sms_transactional_consent_at;
  let txConsentIp = existing.sms_transactional_consent_ip;
  if (recordingPromo || recordingTx) {
    const companyRow = await db
      .prepare("SELECT name FROM company WHERE id = ?")
      .get<{ name: string | null }>(ctx.companyId);
    const businessName = companyRow?.name || "this business";
    const fwd = req.headers.get("x-forwarded-for");
    const ip =
      (fwd ? fwd.split(",")[0]?.trim() : null) ||
      req.headers.get("x-real-ip") ||
      null;
    if (recordingPromo) {
      smsConsent = 1;
      smsConsentText = buildPromotionalSmsConsentText(businessName);
      smsConsentAt = now;
      smsConsentIp = ip;
    }
    if (recordingTx) {
      txConsent = 1;
      txConsentText = buildTransactionalSmsConsentText(businessName);
      txConsentAt = now;
      txConsentIp = ip;
    }
  }

  await db
    .prepare(
      `UPDATE estimates
         SET status = ?, accepted_at = ?, declined_at = ?,
             signature_data = ?, signature_name = ?, signed_at = ?,
             terms = ?, sms_consent = ?, sms_consent_text = ?,
             sms_consent_at = ?, sms_consent_ip = ?,
             sms_transactional_consent = ?, sms_transactional_consent_text = ?,
             sms_transactional_consent_at = ?, sms_transactional_consent_ip = ?,
             updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(
      body.status,
      acceptedAt,
      declinedAt,
      signatureData,
      signatureName,
      signedAt,
      terms,
      smsConsent,
      smsConsentText,
      smsConsentAt,
      smsConsentIp,
      txConsent,
      txConsentText,
      txConsentAt,
      txConsentIp,
      id,
      ctx.companyId
    );

  // On a fresh opt-in (either type), mark the customer's phone as consented
  // (not opted out) for this company, so the messaging layer and audit have a
  // per-phone record. STOP opts out of all message types, so the consent flag
  // here is intentionally type-agnostic.
  if (recordingPromo || recordingTx) {
    const cust = await db
      .prepare("SELECT phone FROM customers WHERE id = ? AND company_id = ?")
      .get<{ phone: string | null }>(existing.customer_id, ctx.companyId);
    const phone = normalizeUSPhone(cust?.phone);
    if (phone) {
      const optRow = await db
        .prepare(
          "SELECT id FROM sms_opt_outs WHERE company_id = ? AND phone = ? LIMIT 1"
        )
        .get<{ id: number }>(ctx.companyId, phone);
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
          .run(ctx.companyId, phone, now);
      }
    }
  }

  const row = (await db
    .prepare("SELECT * FROM estimates WHERE id = ? AND company_id = ?")
    .get(id, ctx.companyId)) as Estimate;
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await db
    .prepare("DELETE FROM estimates WHERE id = ? AND company_id = ?")
    .run(Number(params.id), ctx.companyId);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
