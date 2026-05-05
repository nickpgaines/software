import twilio from "twilio";
import { getDb, type Company } from "@/lib/db";

// Platform-managed Twilio. The platform owns a single master account
// (TWILIO_MASTER_ACCOUNT_SID / TWILIO_MASTER_AUTH_TOKEN) and creates one
// subaccount per tenant company. Each subaccount owns the company's
// purchased phone number(s).

export type PlatformConfig = {
  masterAccountSid: string;
  masterAuthToken: string;
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
    defaultAreaCode: process.env.TWILIO_DEFAULT_AREA_CODE || null,
    inboundSmsWebhookUrl: process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL || null,
    inboundVoiceWebhookUrl:
      process.env.TWILIO_INBOUND_VOICE_WEBHOOK_URL || null,
    a2pCampaignSid: process.env.TWILIO_A2P_CAMPAIGN_SID || null,
  };
}

// Master switch: when off, signup will not auto-provision and sendSms falls
// back to BYO. Flip to "1" once A2P campaign approval clears.
export function isPlatformSmsEnabled(): boolean {
  return process.env.PLATFORM_SMS_ENABLED === "1";
}

export type ProvisionResult =
  | {
      ok: true;
      subaccountSid: string;
      subaccountAuthToken: string;
      phoneNumber: string;
      phoneSid: string;
    }
  | { ok: false; error: string };

// Create a Twilio subaccount for the company and purchase a local number in
// the requested area code. Persists the result onto the company row.
export async function provisionTwilioForCompany(args: {
  companyId: number;
  companyName: string;
  areaCode: string;
}): Promise<ProvisionResult> {
  const { companyId, companyName, areaCode } = args;
  const cfg = getPlatformConfig();
  if (!cfg) return { ok: false, error: "Platform Twilio is not configured" };
  if (!/^\d{3}$/.test(areaCode)) {
    return { ok: false, error: "Area code must be 3 digits" };
  }

  const master = twilio(cfg.masterAccountSid, cfg.masterAuthToken);

  let subaccountSid: string;
  let subaccountAuthToken: string;
  try {
    const subaccount = await master.api.v2010.accounts.create({
      friendlyName: `nick360:${companyId}:${companyName}`.slice(0, 64),
    });
    subaccountSid = subaccount.sid;
    subaccountAuthToken = subaccount.authToken;
  } catch (e) {
    return { ok: false, error: `Subaccount create failed: ${asMsg(e)}` };
  }

  const sub = twilio(subaccountSid, subaccountAuthToken);

  let chosenNumber: string;
  try {
    const available = await sub
      .availablePhoneNumbers("US")
      .local.list({ areaCode: Number(areaCode), smsEnabled: true, limit: 1 });
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
    const purchased = await sub.incomingPhoneNumbers.create({
      phoneNumber: chosenNumber,
      smsUrl: cfg.inboundSmsWebhookUrl ?? undefined,
      smsMethod: cfg.inboundSmsWebhookUrl ? "POST" : undefined,
      voiceUrl: cfg.inboundVoiceWebhookUrl ?? undefined,
      voiceMethod: cfg.inboundVoiceWebhookUrl ? "POST" : undefined,
    });
    phoneSid = purchased.sid;
  } catch (e) {
    return { ok: false, error: `Number purchase failed: ${asMsg(e)}` };
  }

  const db = await getDb();
  await db
    .prepare(
      `UPDATE company
         SET twilio_subaccount_sid = ?,
             twilio_subaccount_auth_token = ?,
             platform_phone_number = ?,
             platform_phone_sid = ?,
             a2p_campaign_status = 'pending',
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(subaccountSid, subaccountAuthToken, chosenNumber, phoneSid, companyId);

  return {
    ok: true,
    subaccountSid,
    subaccountAuthToken,
    phoneNumber: chosenNumber,
    phoneSid,
  };
}

export function hasPlatformSms(c: Pick<Company, "twilio_subaccount_sid" | "twilio_subaccount_auth_token" | "platform_phone_number">): boolean {
  return !!(
    c.twilio_subaccount_sid &&
    c.twilio_subaccount_auth_token &&
    c.platform_phone_number
  );
}

export type PlatformSmsResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string; code?: number };

// Send an SMS using the company's subaccount credentials and platform-issued
// phone number. Caller must verify hasPlatformSms() first.
export async function sendPlatformSms(args: {
  company: Pick<
    Company,
    "twilio_subaccount_sid" | "twilio_subaccount_auth_token" | "platform_phone_number"
  >;
  to: string;
  body: string;
}): Promise<PlatformSmsResult> {
  const { company, to, body } = args;
  if (!hasPlatformSms(company)) {
    return { ok: false, error: "Platform SMS not provisioned for this company" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    company.twilio_subaccount_sid!
  )}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", company.platform_phone_number!);
  form.set("Body", body);

  const auth = Buffer.from(
    `${company.twilio_subaccount_sid}:${company.twilio_subaccount_auth_token}`
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

// Look up the company that owns a given platform-issued phone number. Used by
// the inbound-SMS / inbound-voice webhooks to route the event to the right
// tenant.
export async function findCompanyByPlatformNumber(
  toNumber: string
): Promise<Company | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT * FROM company WHERE platform_phone_number = ? LIMIT 1")
    .get<Company>(toNumber);
  return row ?? null;
}

function asMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
