import { NextResponse } from "next/server";
import { getDb, type MessagingSettings } from "@/lib/db";
import { verifyTwilioSignature } from "@/lib/sms";
import { getPlatformConfig } from "@/lib/twilio-platform";

// Outbound delivery webhook. Twilio POSTs here for each status transition
// (queued -> sending -> sent -> delivered, or -> failed / undelivered) when
// the send included our StatusCallback URL. We persist the latest status
// (and error, if any) onto the matching message row keyed by MessageSid.
//
// Tenant routing: the AccountSid in the payload is either the platform
// master account or a tenant's BYO account. We pick the right auth token
// for signature verification accordingly.

export const dynamic = "force-dynamic";

function buildPublicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  const accountSid = params.AccountSid || "";
  const messageSid = params.MessageSid || "";
  const messageStatus = params.MessageStatus || "";
  const errorCode = params.ErrorCode || "";
  const errorMessage = params.ErrorMessage || "";

  if (!accountSid || !messageSid || !messageStatus) {
    return new NextResponse("Missing required params", { status: 400 });
  }

  // Pick the auth token to verify with: master if this is a platform send,
  // otherwise the tenant's BYO auth token (looked up by AccountSid).
  let authToken: string | null = null;
  const platform = getPlatformConfig();
  if (platform && accountSid === platform.masterAccountSid) {
    authToken = platform.masterAuthToken;
  } else {
    const db = await getDb();
    const settings = (await db
      .prepare("SELECT * FROM messaging_settings WHERE account_sid = ? LIMIT 1")
      .get(accountSid)) as MessagingSettings | undefined;
    if (settings && settings.auth_token) {
      authToken = settings.auth_token;
    }
  }

  if (!authToken) {
    console.warn(
      `[twilio/status-callback] Unknown AccountSid ${accountSid}; dropping.`
    );
    return new NextResponse("Unknown account", { status: 404 });
  }

  const signature = req.headers.get("x-twilio-signature") || "";
  const url = buildPublicUrl(req);
  const valid = verifyTwilioSignature({
    authToken,
    url,
    params,
    signature,
  });
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // Combine ErrorCode + ErrorMessage into a single human string. For success
  // states we clear any prior error so a transient send-time error doesn't
  // stick around once the message actually delivers.
  const isErrorState =
    messageStatus === "failed" || messageStatus === "undelivered";
  let errorText: string | null = null;
  if (isErrorState) {
    if (errorMessage && errorCode) {
      errorText = `${errorMessage} (Twilio ${errorCode})`;
    } else if (errorMessage) {
      errorText = errorMessage;
    } else if (errorCode) {
      errorText = `Twilio error ${errorCode}`;
    } else {
      errorText = messageStatus === "undelivered" ? "Undelivered" : "Failed";
    }
  }

  const db = await getDb();
  await db
    .prepare(
      `UPDATE messages
         SET status = ?, error = ?
       WHERE provider_sid = ? AND direction = 'outbound'`
    )
    .run(messageStatus, errorText, messageSid);

  return new NextResponse("", { status: 204 });
}
