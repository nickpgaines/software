import twilio from "twilio";
import { getDb, type MessagingSettings } from "@/lib/db";

export async function getVoiceSettings(): Promise<MessagingSettings> {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT * FROM messaging_settings WHERE id = 1")
      .get()) as MessagingSettings | undefined;
    return (
      row ?? {
        id: 1,
        company_id: 1,
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

export function isVoiceConfigured(s: MessagingSettings): boolean {
  return !!(
    s.account_sid &&
    s.voice_api_key_sid &&
    s.voice_api_key_secret &&
    s.voice_twiml_app_sid &&
    s.from_number
  );
}

export type VoiceAccessTokenInput = {
  settings: MessagingSettings;
  identity: string;
  ttlSeconds?: number;
};

export function createVoiceAccessToken(input: VoiceAccessTokenInput): string {
  const { settings, identity } = input;
  const ttl = input.ttlSeconds ?? 60 * 60;
  if (!isVoiceConfigured(settings)) {
    throw new Error("Voice is not configured");
  }
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const grant = new VoiceGrant({
    outgoingApplicationSid: settings.voice_twiml_app_sid!,
    incomingAllow: false,
  });

  const token = new AccessToken(
    settings.account_sid!,
    settings.voice_api_key_sid!,
    settings.voice_api_key_secret!,
    { identity, ttl }
  );
  token.addGrant(grant);
  return token.toJwt();
}

// Fetch a Twilio recording media URL with Basic Auth and stream it back.
// Twilio recording URLs require the account SID + auth token to access.
export async function fetchTwilioRecording(args: {
  settings: MessagingSettings;
  recordingSid: string;
  format?: "mp3" | "wav";
}): Promise<{
  ok: true;
  body: ReadableStream<Uint8Array>;
  contentType: string;
} | { ok: false; status: number; error: string }> {
  const { settings, recordingSid } = args;
  const format = args.format ?? "mp3";
  if (!settings.account_sid || !settings.auth_token) {
    return {
      ok: false,
      status: 503,
      error: "Twilio account credentials are not configured",
    };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    settings.account_sid
  )}/Recordings/${encodeURIComponent(recordingSid)}.${format}`;
  const auth = Buffer.from(
    `${settings.account_sid}:${settings.auth_token}`
  ).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok || !res.body) {
    return {
      ok: false,
      status: res.status,
      error: `Twilio responded ${res.status}`,
    };
  }
  return {
    ok: true,
    body: res.body,
    contentType: res.headers.get("content-type") || `audio/${format}`,
  };
}
