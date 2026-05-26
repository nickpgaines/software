import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMessagingConfigured, verifyTwilioSignature } from "@/lib/sms";
import { getPlatformConfig } from "@/lib/twilio-platform";

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

// Reconstruct the exact public URL Twilio signed (must match the StatusCallback
// we handed it). Mirrors the inbound webhook's reconstruction.
function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

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
  const signature = req.headers.get("x-twilio-signature") || "";
  const url = buildPublicUrl(req);
  const db = await getDb();
  let signatureValid = false;
  if (cfg && accountSid === cfg.masterAccountSid) {
    signatureValid = verifyTwilioSignature({
      authToken: cfg.masterAuthToken,
      url,
      params,
      signature,
    });
  } else {
    const subaccount = (await db
      .prepare(
        "SELECT twilio_subaccount_auth_token FROM company WHERE twilio_subaccount_sid = ? LIMIT 1"
      )
      .get(accountSid)) as
      | { twilio_subaccount_auth_token: string | null }
      | undefined;
    if (subaccount?.twilio_subaccount_auth_token) {
      signatureValid = verifyTwilioSignature({
        authToken: subaccount.twilio_subaccount_auth_token,
        url,
        params,
        signature,
      });
    }
    if (!signatureValid) {
      const settings = (await db
        .prepare(
          "SELECT * FROM messaging_settings WHERE account_sid = ? LIMIT 1"
        )
        .get(accountSid)) as { auth_token: string | null } | undefined;
      if (settings?.auth_token && isMessagingConfigured(settings as never)) {
        signatureValid = verifyTwilioSignature({
          authToken: settings.auth_token,
          url,
          params,
          signature,
        });
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

  await db
    .prepare(
      `UPDATE messages
          SET status = ?,
              error_code = ?,
              error = COALESCE(?, error)
        WHERE provider_sid = ? AND direction = 'outbound'`
    )
    .run(
      messageStatus,
      errorCode ? Number(errorCode) : null,
      reason,
      messageSid
    );

  return new NextResponse(null, { status: 204 });
}
