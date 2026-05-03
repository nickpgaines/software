import crypto from "node:crypto";
import { getDb, type Company, type MessagingSettings } from "@/lib/db";
import { hasPlatformSms, sendPlatformSms } from "@/lib/twilio-platform";

export type SmsSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string; code?: number };

export async function getMessagingSettings(
  companyId: number
): Promise<MessagingSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Turso may route
  // plain reads to an edge replica that lags behind the primary, which would
  // make freshly-saved credentials look unset.
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare(
        "SELECT * FROM messaging_settings WHERE company_id = ? LIMIT 1"
      )
      .get(companyId)) as MessagingSettings | undefined;
    return (
      row ?? {
        id: 0,
        company_id: companyId,
        provider: "twilio",
        account_sid: null,
        auth_token: null,
        from_number: null,
        voice_api_key_sid: null,
        voice_api_key_secret: null,
        voice_twiml_app_sid: null,
        voice_record_calls: 1,
        updated_at: "",
      }
    );
  });
}

export function isMessagingConfigured(s: MessagingSettings): boolean {
  return !!(s.account_sid && s.auth_token && s.from_number);
}

// US-only normalization. Strips non-digits; if 10 digits, prepends +1; if 11
// digits starting with 1, prepends +; if already E.164, returns as-is.
// Returns null if it cannot produce a plausible E.164 number.
export function normalizeUSPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Returns the company's effective messaging configuration: prefers the
// platform-managed phone number if provisioned, otherwise falls back to BYO
// messaging_settings. `fromPhone` is null if neither is configured.
export async function getCompanyMessagingStatus(companyId: number): Promise<{
  configured: boolean;
  fromPhone: string | null;
  source: "platform" | "byo" | "none";
}> {
  const db = await getDb();
  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(companyId);
  if (company && hasPlatformSms(company)) {
    return {
      configured: true,
      fromPhone: company.platform_phone_number,
      source: "platform",
    };
  }
  const settings = await getMessagingSettings(companyId);
  if (isMessagingConfigured(settings)) {
    return {
      configured: true,
      fromPhone: settings.from_number,
      source: "byo",
    };
  }
  return { configured: false, fromPhone: null, source: "none" };
}

// High-level send: prefer the platform-managed Twilio subaccount if the
// company has been provisioned, otherwise fall back to the company's BYO
// credentials. Callers should use this instead of sendSms() directly so the
// BYO escape hatch keeps working for any tenant without a platform number.
export async function sendCompanySms(args: {
  companyId: number;
  to: string;
  body: string;
}): Promise<SmsSendResult> {
  const { companyId, to, body } = args;
  const db = await getDb();
  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(companyId);
  if (company && hasPlatformSms(company)) {
    return sendPlatformSms({ company, to, body });
  }
  const settings = await getMessagingSettings(companyId);
  return sendSms({ settings, to, body });
}

export async function sendSms(args: {
  settings: MessagingSettings;
  to: string;
  body: string;
}): Promise<SmsSendResult> {
  const { settings, to, body } = args;
  if (!isMessagingConfigured(settings)) {
    return { ok: false, error: "Messaging is not configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    settings.account_sid!
  )}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", settings.from_number!);
  form.set("Body", body);

  const auth = Buffer.from(
    `${settings.account_sid}:${settings.auth_token}`
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

// Twilio computes X-Twilio-Signature as the base64 HMAC-SHA1 of:
//   fullRequestUrl + concat(sortedKey + value for each POST param)
// using the auth token as the key.
export function verifyTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string;
}): boolean {
  const { authToken, url, params, signature } = args;
  if (!authToken || !signature) return false;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const k of keys) data += k + params[k];
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(data, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}
