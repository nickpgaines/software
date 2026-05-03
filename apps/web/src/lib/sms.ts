import { getDb } from "@/lib/db";
import { getPrimaryNumber } from "@/lib/phoneNumbers";
import {
  basicAuthHeader,
  getPlatformTwilioCreds,
  getPlatformTwilioStatus,
  verifyTwilioSignature as verifyTwilioSignatureShared,
} from "@/lib/twilio";

export type SmsSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string; code?: number };

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

export type CompanyMessagingStatus = {
  platform_configured: boolean;
  has_number: boolean;
  primary_number: string | null;
};

export async function getCompanyMessagingStatus(
  companyId: number
): Promise<CompanyMessagingStatus> {
  const platform = getPlatformTwilioStatus();
  const primary = await getPrimaryNumber(companyId);
  return {
    platform_configured: platform.messagingConfigured,
    has_number: !!primary,
    primary_number: primary?.phone_number ?? null,
  };
}

export function isCompanyMessagingReady(s: CompanyMessagingStatus): boolean {
  return s.platform_configured && s.has_number;
}

export async function sendSms(args: {
  companyId: number;
  to: string;
  body: string;
  from?: string;
}): Promise<SmsSendResult & { from?: string | null }> {
  const platform = getPlatformTwilioStatus();
  if (!platform.messagingConfigured) {
    return {
      ok: false,
      error: `Platform Twilio is not configured (missing: ${platform.missing.join(", ")}).`,
    };
  }
  let fromPhone = args.from || null;
  if (!fromPhone) {
    const primary = await getPrimaryNumber(args.companyId);
    fromPhone = primary?.phone_number ?? null;
  }
  if (!fromPhone) {
    return {
      ok: false,
      error: "This company has no phone number. Buy one in Settings → Messaging.",
    };
  }

  const creds = getPlatformTwilioCreds();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    creds.accountSid
  )}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", args.to);
  form.set("From", fromPhone);
  form.set("Body", args.body);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(creds.accountSid, creds.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Network error", from: fromPhone };
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
      from: fromPhone,
    };
  }
  return { ok: true, sid: data.sid || "", status: data.status || "queued", from: fromPhone };
}

// Re-export for callers that imported the legacy name from this module.
export const verifyTwilioSignature = verifyTwilioSignatureShared;

// Lookup helper kept here for callers in routes — webhook handlers use it to
// resolve which company a Twilio inbound webhook belongs to via the To number.
export async function getCompanyIdForIncomingNumber(
  toPhone: string
): Promise<number | null> {
  if (!toPhone) return null;
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT company_id FROM phone_numbers
        WHERE phone_number = ? AND status = 'active' LIMIT 1`
    )
    .get(toPhone)) as { company_id: number } | undefined;
  return row?.company_id ?? null;
}
