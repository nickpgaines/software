import crypto from "node:crypto";
import { getDb, type MessagingSettings } from "@/lib/db";

export type SmsSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string; code?: number };

export async function getMessagingSettings(): Promise<MessagingSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Turso may route
  // plain reads to an edge replica that lags behind the primary, which would
  // make freshly-saved credentials look unset.
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT * FROM messaging_settings WHERE id = 1")
      .get()) as MessagingSettings | undefined;
    return (
      row ?? {
        id: 1,
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
