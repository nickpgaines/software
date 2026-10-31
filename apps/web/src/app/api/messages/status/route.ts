import { NextResponse } from "next/server";
import { getDb, type MessagingSettings } from "@/lib/db";
import { isMessagingConfigured } from "@/lib/sms";
import { getPlatformConfig } from "@/lib/twilio-platform";
import { verifyTwilioWebhook } from "@/lib/twilio-webhook-signature";

export const dynamic = "force-dynamic";

// Twilio delivery error codes → a short human-readable reason, stored on the
// message row so a blast's misses aren't silent. Not exhaustive; unknown codes
// fall back to a generic label.
const ERROR_REASONS: Record<string, string> = {
  "30003": "Unreachable handset (off or out of coverage)",
  "30004": "Message blocked by the carrier or recipient",
  "30005": "Unknown or inactive number",
  "30006": "Landline or unreachable carrier",
  "30007": "Filtered as spam by the carrier",
  "30008": "Carrier delivery failure",
  "30022": "10DLC daily/throughput limit reached",
  "30034": "Sent from an unregistered 10DLC number",
};

export async function POST(req: Request) {
  const cfg = getPlatformConfig();

  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  const messageSid = params.MessageSid || "";
  const messageStatus = params.MessageStatus || params.SmsStatus || "";
  const accountSid = params.AccountSid || "";
  const errorCode = params.ErrorCode || "";

  if (!messageSid || !messageStatus || !accountSid) {
    return new NextResponse("Missing required params", { status: 400 });
  }

  // Verify against the auth token of whichever account sent the message:
  // master (trial pool), the tenant subaccount (dedicated), or a BYO account.
  const db = await getDb();
  let signatureValid = false;
  const companyIds: number[] = [];
  const isMasterAccount = !!cfg && accountSid === cfg.masterAccountSid;
  if (cfg && isMasterAccount) {
    signatureValid = verifyTwilioWebhook(req, params, cfg.masterAuthToken);
  } else {
    const subaccount = (await db
      .prepare(
        "SELECT id, twilio_subaccount_auth_token FROM company WHERE twilio_subaccount_sid = ? LIMIT 1"
      )
      .get(accountSid)) as
      | { id: number; twilio_subaccount_auth_token: string | null }
      | undefined;
    if (subaccount?.twilio_subaccount_auth_token) {
      signatureValid = verifyTwilioWebhook(req, params, subaccount.twilio_subaccount_auth_token);
      if (signatureValid) companyIds.push(subaccount.id);
    }
    if (!signatureValid) {
      const settings = await db
        .prepare(
          "SELECT * FROM messaging_settings WHERE account_sid = ?"
        )
        .all<MessagingSettings>(accountSid);
      for (const setting of settings) {
        if (isMessagingConfigured(setting) && verifyTwilioWebhook(req, params, setting.auth_token)) {
          signatureValid = true;
          companyIds.push(setting.company_id);
        }
      }
    }
  }
  if (!signatureValid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const failed = messageStatus === "failed" || messageStatus === "undelivered";
  const reason = failed
    ? ERROR_REASONS[errorCode] ||
      (errorCode ? `Carrier error ${errorCode}` : "Delivery failed")
    : null;

  // A BYO/subaccount token authenticates that tenant, not every message in
  // Forge. Only the private platform token owns the shared pool across tenants.
  const tenantFilter = isMasterAccount ? "" : ` AND company_id IN (${companyIds.map(() => "?").join(",")})`;
  await db
    .prepare(
      `UPDATE messages
          SET status = ?,
              error_code = ?,
              error = COALESCE(?, error)
        WHERE provider_sid = ? AND direction = 'outbound'${tenantFilter}`
    )
    .run(
      messageStatus,
      errorCode ? Number(errorCode) : null,
      reason,
      messageSid,
      ...companyIds
    );

  return new NextResponse(null, { status: 204 });
}
