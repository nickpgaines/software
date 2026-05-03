import twilio from "twilio";
import { getDb } from "@/lib/db";
import {
  basicAuthHeader,
  buildVoiceIdentity,
  getPlatformTwilioCreds,
  getPlatformTwilioStatus,
} from "@/lib/twilio";
import { getPrimaryNumber } from "@/lib/phoneNumbers";

export type CompanyVoiceStatus = {
  platform_configured: boolean;
  has_number: boolean;
  primary_number: string | null;
  record_calls: boolean;
};

// Per-company voice toggles still live in the messaging_settings table — only
// the `voice_record_calls` flag is read now; credential columns are ignored.
async function readRecordCallsFlag(companyId: number): Promise<boolean> {
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT voice_record_calls FROM messaging_settings WHERE company_id = ? LIMIT 1"
    )
    .get(companyId)) as { voice_record_calls: number | null } | undefined;
  return row?.voice_record_calls === 1 || row?.voice_record_calls == null;
}

export async function getCompanyVoiceStatus(
  companyId: number
): Promise<CompanyVoiceStatus> {
  const platform = getPlatformTwilioStatus();
  const primary = await getPrimaryNumber(companyId);
  const record = await readRecordCallsFlag(companyId);
  return {
    platform_configured: platform.voiceConfigured,
    has_number: !!primary,
    primary_number: primary?.phone_number ?? null,
    record_calls: record,
  };
}

export function isCompanyVoiceReady(s: CompanyVoiceStatus): boolean {
  return s.platform_configured && s.has_number;
}

export async function setRecordCallsFlag(args: {
  companyId: number;
  record: boolean;
}): Promise<void> {
  const db = await getDb();
  const value = args.record ? 1 : 0;
  const existing = (await db
    .prepare(
      "SELECT id FROM messaging_settings WHERE company_id = ? LIMIT 1"
    )
    .get(args.companyId)) as { id: number } | undefined;
  if (existing) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET voice_record_calls = ?, updated_at = datetime('now')
          WHERE id = ?`
      )
      .run(value, existing.id);
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, voice_record_calls, updated_at)
         VALUES (?, 'twilio', ?, datetime('now'))`
      )
      .run(args.companyId, value);
  }
}

export type VoiceAccessTokenInput = {
  companyId: number;
  user: string;
  ttlSeconds?: number;
};

export function createVoiceAccessToken(input: VoiceAccessTokenInput): {
  token: string;
  identity: string;
} {
  const platform = getPlatformTwilioStatus();
  if (!platform.voiceConfigured) {
    throw new Error(
      `Voice is not configured (missing: ${platform.missing.join(", ")}).`
    );
  }
  const creds = getPlatformTwilioCreds();
  const ttl = input.ttlSeconds ?? 60 * 60;
  const identity = buildVoiceIdentity(input.companyId, input.user);

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const grant = new VoiceGrant({
    outgoingApplicationSid: creds.twimlAppSid,
    incomingAllow: false,
  });
  const token = new AccessToken(creds.accountSid, creds.apiKeySid, creds.apiKeySecret, {
    identity,
    ttl,
  });
  token.addGrant(grant);
  return { token: token.toJwt(), identity };
}

// Fetch a Twilio recording media URL with Basic Auth and stream it back.
// Twilio recording URLs require the master account SID + auth token.
export async function fetchTwilioRecording(args: {
  recordingSid: string;
  format?: "mp3" | "wav";
}): Promise<{
  ok: true;
  body: ReadableStream<Uint8Array>;
  contentType: string;
} | { ok: false; status: number; error: string }> {
  const platform = getPlatformTwilioStatus();
  if (!platform.messagingConfigured) {
    return {
      ok: false,
      status: 503,
      error: "Platform Twilio account credentials are not configured.",
    };
  }
  const creds = getPlatformTwilioCreds();
  const format = args.format ?? "mp3";
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    creds.accountSid
  )}/Recordings/${encodeURIComponent(args.recordingSid)}.${format}`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuthHeader(creds.accountSid, creds.authToken) },
  });
  if (!res.ok || !res.body) {
    return { ok: false, status: res.status, error: `Twilio responded ${res.status}` };
  }
  return {
    ok: true,
    body: res.body,
    contentType: res.headers.get("content-type") || `audio/${format}`,
  };
}
