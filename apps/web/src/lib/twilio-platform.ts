import twilio from "twilio";
import { getDb, type Company } from "@/lib/db";

// Platform-managed Twilio. The platform owns a single master account
// (TWILIO_MASTER_ACCOUNT_SID / TWILIO_MASTER_AUTH_TOKEN) and a single
// Messaging Service tied to one A2P brand + campaign. All tenant numbers
// live in the master account and are added to the Messaging Service so they
// inherit campaign approval and carrier compliance.
//
// Subaccount-per-tenant was the original plan but is incompatible with one
// shared A2P campaign — Messaging Services and the numbers in them must
// belong to the same Twilio account. Per-tenant billing isolation is now
// metered inside our own app rather than at the Twilio account boundary.

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
    masterAccountSid: cfg.masterAccountSid,
    masterAuthToken: cfg.masterAuthToken,
    to: args.to,
    body: args.body,
    from: null,
    messagingServiceSid: cfg.trialPoolMessagingServiceSid,
  });
}

// Send through a tenant's own approved Messaging Service. Used once their
// 10DLC chain reaches campaign_approved and they have a dedicated number.
export async function sendDedicatedSms(args: {
  company: Pick<
    Company,
    "twilio_messaging_service_sid" | "sms_dedicated_number"
  >;
  to: string;
  body: string;
}): Promise<PlatformSmsResult> {
  const cfg = getPlatformConfig();
  if (!cfg) return { ok: false, error: "Platform Twilio is not configured" };
  if (!args.company.twilio_messaging_service_sid) {
    return {
      ok: false,
      error: "Tenant has no Messaging Service provisioned",
    };
  }
  return postTwilioMessage({
    masterAccountSid: cfg.masterAccountSid,
    masterAuthToken: cfg.masterAuthToken,
    to: args.to,
    body: args.body,
    from: args.company.sms_dedicated_number ?? null,
    messagingServiceSid: args.company.twilio_messaging_service_sid,
  });
}

async function postTwilioMessage(args: {
  masterAccountSid: string;
  masterAuthToken: string;
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

  const auth = Buffer.from(
    `${args.masterAccountSid}:${args.masterAuthToken}`
  ).toString("base64");

  let res: Response;
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        args.masterAccountSid
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
