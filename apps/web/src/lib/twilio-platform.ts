import twilio from "twilio";
import { getDb, type Company } from "@/lib/db";
import { createSubaccount, type TwilioCreds } from "@/lib/twilio-trust-hub";

// Resolve the master-account credentials. Returns null if env vars are
// unset; callers should treat that as a configuration error.
export function getMasterCreds(): TwilioCreds | null {
  const cfg = getPlatformConfig();
  if (!cfg) return null;
  return {
    accountSid: cfg.masterAccountSid,
    authToken: cfg.masterAuthToken,
  };
}

// Idempotently ensure a Twilio subaccount exists for this tenant and return
// its credentials. The subaccount Auth Token is only returned by Twilio at
// creation time — we capture it and store it on the company row. The trial
// pool stays on the master account; only per-tenant resources run inside the
// subaccount container.
export async function ensureTenantSubaccount(args: {
  companyId: number;
  friendlyName: string;
}): Promise<TwilioCreds> {
  const master = getMasterCreds();
  if (!master) throw new Error("Platform Twilio is not configured");

  const db = await getDb();
  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(args.companyId);
  if (!company) throw new Error(`Company ${args.companyId} not found`);

  if (company.twilio_subaccount_sid && company.twilio_subaccount_auth_token) {
    return {
      accountSid: company.twilio_subaccount_sid,
      authToken: company.twilio_subaccount_auth_token,
    };
  }

  const sub = await createSubaccount({
    masterCreds: master,
    friendlyName: `nick360 tenant ${args.companyId} (${args.friendlyName})`,
  });
  await db
    .prepare(
      `UPDATE company
          SET twilio_subaccount_sid = ?,
              twilio_subaccount_auth_token = ?,
              updated_at = datetime('now')
        WHERE id = ?`
    )
    .run(sub.sid, sub.auth_token, args.companyId);
  return { accountSid: sub.sid, authToken: sub.auth_token };
}

// Platform-managed Twilio. The master account (TWILIO_MASTER_ACCOUNT_SID /
// TWILIO_MASTER_AUTH_TOKEN) holds the shared trial pool, which sends one-way
// for trial + paid_pending tenants. Paid (paid_approved) tenants each get
// their OWN Twilio subaccount with their own A2P brand + campaign + dedicated
// number — see sms-registration.ts and sendDedicatedSms below. That per-tenant
// isolation is what lets us vet or suspend one tenant without touching others.
//
// NOTE: provisionTwilioForCompany / sendPlatformSms / hasPlatformSms below are
// legacy from an earlier "one shared brand+campaign for everyone" design. They
// are no longer wired into the send path (sendCompanySms routes paid tenants to
// sendDedicatedSms) and are kept only until that dead path is removed.

export type PlatformConfig = {
  masterAccountSid: string;
  masterAuthToken: string;
  messagingServiceSid: string | null;
  trialPoolMessagingServiceSid: string | null;
  defaultAreaCode: string | null;
  inboundSmsWebhookUrl: string | null;
  inboundVoiceWebhookUrl: string | null;
  a2pCampaignSid: string | null;
};

export function getPlatformConfig(): PlatformConfig | null {
  const masterAccountSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
  const masterAuthToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
  if (!masterAccountSid || !masterAuthToken) return null;
  return {
    masterAccountSid,
    masterAuthToken,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
    trialPoolMessagingServiceSid:
      process.env.TWILIO_TRIAL_POOL_MESSAGING_SERVICE_SID || null,
    defaultAreaCode: process.env.TWILIO_DEFAULT_AREA_CODE || null,
    inboundSmsWebhookUrl: process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL || null,
    inboundVoiceWebhookUrl:
      process.env.TWILIO_INBOUND_VOICE_WEBHOOK_URL || null,
    a2pCampaignSid: process.env.TWILIO_A2P_CAMPAIGN_SID || null,
  };
}

// Master switch: when off, signup will not auto-provision and sendCompanySms
// falls back to BYO. Flip to "1" once A2P campaign approval clears.
export function isPlatformSmsEnabled(): boolean {
  return process.env.PLATFORM_SMS_ENABLED === "1";
}

export type ProvisionResult =
  | { ok: true; phoneNumber: string; phoneSid: string }
  | { ok: false; error: string };

// Buy a local number in the requested area code under the master account
// and attach it to the platform Messaging Service so it inherits the A2P
// campaign. Persists the result onto the company row.
export async function provisionTwilioForCompany(args: {
  companyId: number;
  companyName: string;
  areaCode: string;
}): Promise<ProvisionResult> {
  const { companyId, companyName, areaCode } = args;
  const cfg = getPlatformConfig();
  if (!cfg) return { ok: false, error: "Platform Twilio is not configured" };
  if (!cfg.messagingServiceSid) {
    return {
      ok: false,
      error: "TWILIO_MESSAGING_SERVICE_SID is not configured",
    };
  }
  if (!/^\d{3}$/.test(areaCode)) {
    return { ok: false, error: "Area code must be 3 digits" };
  }

  const client = twilio(cfg.masterAccountSid, cfg.masterAuthToken);

  let chosenNumber: string;
  try {
    const available = await client.availablePhoneNumbers("US").local.list({
      areaCode: Number(areaCode),
      smsEnabled: true,
      voiceEnabled: true,
      limit: 1,
    });
    if (available.length === 0) {
      return {
        ok: false,
        error: `No available local numbers in area code ${areaCode}`,
      };
    }
    chosenNumber = available[0].phoneNumber;
  } catch (e) {
    return { ok: false, error: `Number search failed: ${asMsg(e)}` };
  }

  let phoneSid: string;
  try {
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: chosenNumber,
      friendlyName: `nick360:${companyId}:${companyName}`.slice(0, 64),
      smsUrl: cfg.inboundSmsWebhookUrl ?? undefined,
      smsMethod: cfg.inboundSmsWebhookUrl ? "POST" : undefined,
      voiceUrl: cfg.inboundVoiceWebhookUrl ?? undefined,
      voiceMethod: cfg.inboundVoiceWebhookUrl ? "POST" : undefined,
    });
    phoneSid = purchased.sid;
  } catch (e) {
    return { ok: false, error: `Number purchase failed: ${asMsg(e)}` };
  }

  // Attach the new number to the Messaging Service so the A2P campaign
  // covers it. Without this step, outbound traffic from the number would
  // be unregistered and carrier-throttled.
  try {
    await client.messaging.v1
      .services(cfg.messagingServiceSid)
      .phoneNumbers.create({ phoneNumberSid: phoneSid });
  } catch (e) {
    return {
      ok: false,
      error: `Messaging Service attach failed: ${asMsg(e)}`,
    };
  }

  const db = await getDb();
  await db
    .prepare(
      `UPDATE company
         SET platform_phone_number = ?,
             platform_phone_sid = ?,
             a2p_campaign_status = 'active',
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(chosenNumber, phoneSid, companyId);

  return { ok: true, phoneNumber: chosenNumber, phoneSid };
}

export function hasPlatformSms(
  c: Pick<Company, "platform_phone_number">
): boolean {
  return !!c.platform_phone_number;
}

export type PlatformSmsResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string; code?: number };

// Send via the master account. We pass both From (the tenant's platform
// number, so the recipient sees the right caller ID) and MessagingServiceSid
// (so the message is attributed to the A2P campaign and inherits compliance
// routing).
export async function sendPlatformSms(args: {
  company: Pick<Company, "platform_phone_number">;
  to: string;
  body: string;
}): Promise<PlatformSmsResult> {
  const { company, to, body } = args;
  const cfg = getPlatformConfig();
  if (!cfg || !cfg.messagingServiceSid) {
    return { ok: false, error: "Platform messaging is not configured" };
  }
  if (!company.platform_phone_number) {
    return {
      ok: false,
      error: "Company has no platform phone number provisioned",
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    cfg.masterAccountSid
  )}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", company.platform_phone_number);
  form.set("MessagingServiceSid", cfg.messagingServiceSid);
  form.set("Body", body);

  const auth = Buffer.from(
    `${cfg.masterAccountSid}:${cfg.masterAuthToken}`
  ).toString("base64");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Network error" };
  }

  const data = (await res.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
    code?: number;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || `Twilio error ${res.status}`,
      code: data.code,
    };
  }
  return { ok: true, sid: data.sid || "", status: data.status || "queued" };
}

// Look up the company that owns a given platform-issued phone number. Used
// by the inbound webhooks to route the event to the right tenant.
export async function findCompanyByPlatformNumber(
  toNumber: string
): Promise<Company | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT * FROM company
         WHERE platform_phone_number = ?
            OR sms_dedicated_number = ?
         LIMIT 1`
    )
    .get<Company>(toNumber, toNumber);
  return row ?? null;
}

// Send through the shared trial-pool Messaging Service. Twilio picks From
// from whatever numbers are attached to that service; sticky-sender keeps
// each (tenant, recipient) pair routed through the same number once the
// first message goes out.
export async function sendTrialPoolSms(args: {
  to: string;
  body: string;
}): Promise<PlatformSmsResult> {
  const cfg = getPlatformConfig();
  if (!cfg) return { ok: false, error: "Platform Twilio is not configured" };
  if (!cfg.trialPoolMessagingServiceSid) {
    return {
      ok: false,
      error:
        "TWILIO_TRIAL_POOL_MESSAGING_SERVICE_SID is not configured — trial outbound SMS is offline",
    };
  }
  return postTwilioMessage({
    accountSid: cfg.masterAccountSid,
    authToken: cfg.masterAuthToken,
    to: args.to,
    body: args.body,
    from: null,
    messagingServiceSid: cfg.trialPoolMessagingServiceSid,
  });
}

// Send through a tenant's own approved Messaging Service. The Messaging
// Service lives inside the tenant's subaccount, so we sign the request
// with subaccount credentials; the master account doesn't see the message
// at all beyond the consolidated bill.
export async function sendDedicatedSms(args: {
  company: Pick<
    Company,
    | "twilio_messaging_service_sid"
    | "sms_dedicated_number"
    | "twilio_subaccount_sid"
    | "twilio_subaccount_auth_token"
  >;
  to: string;
  body: string;
}): Promise<PlatformSmsResult> {
  if (!args.company.twilio_messaging_service_sid) {
    return {
      ok: false,
      error: "Tenant has no Messaging Service provisioned",
    };
  }
  if (
    !args.company.twilio_subaccount_sid ||
    !args.company.twilio_subaccount_auth_token
  ) {
    return {
      ok: false,
      error: "Tenant has no Twilio subaccount provisioned",
    };
  }
  return postTwilioMessage({
    accountSid: args.company.twilio_subaccount_sid,
    authToken: args.company.twilio_subaccount_auth_token,
    to: args.to,
    body: args.body,
    from: args.company.sms_dedicated_number ?? null,
    messagingServiceSid: args.company.twilio_messaging_service_sid,
  });
}

async function postTwilioMessage(args: {
  accountSid: string;
  authToken: string;
  to: string;
  body: string;
  from: string | null;
  messagingServiceSid: string;
}): Promise<PlatformSmsResult> {
  const form = new URLSearchParams();
  form.set("To", args.to);
  form.set("MessagingServiceSid", args.messagingServiceSid);
  form.set("Body", args.body);
  if (args.from) form.set("From", args.from);
  // Ask Twilio to call us back with the async delivery outcome so a filtered
  // or failed message stops looking "sent". Handled by /api/messages/status.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    form.set(
      "StatusCallback",
      `${appUrl.replace(/\/$/, "")}/api/messages/status`
    );
  }

  const auth = Buffer.from(
    `${args.accountSid}:${args.authToken}`
  ).toString("base64");

  let res: Response;
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        args.accountSid
      )}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Network error" };
  }
  const data = (await res.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
    code?: number;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || `Twilio error ${res.status}`,
      code: data.code,
    };
  }
  return { ok: true, sid: data.sid || "", status: data.status || "queued" };
}

function asMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
