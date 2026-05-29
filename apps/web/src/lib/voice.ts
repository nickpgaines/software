import twilio from "twilio";
import { getDb, type Company, type MessagingSettings } from "@/lib/db";

export async function getVoiceSettings(
  companyId: number
): Promise<MessagingSettings> {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare(
        "SELECT * FROM messaging_settings WHERE company_id = ? LIMIT 1"
      )
      .get(companyId)) as MessagingSettings | undefined;
    return row ?? emptyVoiceSettings(companyId);
  });
}

export function emptyVoiceSettings(companyId: number): MessagingSettings {
  return {
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
    voice_caller_id_name: null,
    voice_voicemail_greeting_data_url: null,
    voice_capability_verified: 0,
    updated_at: "",
  };
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

// Resolve the Twilio account that owns the tenant's dedicated number. The
// standard path is per-tenant: the number lives on the tenant's subaccount,
// purchased once the A2P campaign approves. Legacy tenants (configured by
// hand before that flow existed) instead have credentials + the number's
// E.164 on messaging_settings; we look the PhoneNumber SID up live in that
// case so they can still enable calling.
type CallingContext =
  | {
      ok: true;
      accountSid: string;
      // For Basic Auth against the Twilio REST API. May be either the
      // account auth token (authUsername == accountSid) or an API Key SID
      // (authUsername == "SK…"). Either authenticates calls scoped to
      // accountSid.
      authUsername: string;
      authPassword: string;
      // Plain auth token if we have one, "" if we only had API key creds.
      // Used for endpoints that require the literal token (e.g. recording
      // playback via Basic Auth on api.twilio.com).
      authToken: string;
      phoneNumber: string;
      phoneNumberSid: string;
    }
  | { ok: false; reason: "no_subaccount" | "no_number" | "lookup_failed"; error?: string };

export async function resolveCallingContext(
  company: Pick<
    Company,
    | "twilio_subaccount_sid"
    | "twilio_subaccount_auth_token"
    | "sms_dedicated_number"
    | "sms_dedicated_number_sid"
  >,
  settings: MessagingSettings
): Promise<CallingContext> {
  // Preferred path: number lives on the tenant's subaccount and we already
  // have its SID on the company row.
  if (
    company.twilio_subaccount_sid &&
    company.twilio_subaccount_auth_token &&
    company.sms_dedicated_number &&
    company.sms_dedicated_number_sid
  ) {
    return {
      ok: true,
      accountSid: company.twilio_subaccount_sid,
      authUsername: company.twilio_subaccount_sid,
      authPassword: company.twilio_subaccount_auth_token,
      authToken: company.twilio_subaccount_auth_token,
      phoneNumber: company.sms_dedicated_number,
      phoneNumberSid: company.sms_dedicated_number_sid,
    };
  }

  // Legacy path: messaging_settings holds account creds + the number's
  // E.164. Auth-token-backed creds are preferred (they let us mint new API
  // keys, change number config, etc.), but lots of legacy tenants only ever
  // pasted an SK/Secret pair -- so when auth_token is missing we sign Twilio
  // requests with the API Key creds against the same Account SID.
  if (settings.account_sid && settings.from_number) {
    const credPairs: { username: string; password: string; authToken?: string }[] = [];
    if (settings.auth_token) {
      credPairs.push({
        username: settings.account_sid,
        password: settings.auth_token,
        authToken: settings.auth_token,
      });
    }
    if (settings.voice_api_key_sid && settings.voice_api_key_secret) {
      credPairs.push({
        username: settings.voice_api_key_sid,
        password: settings.voice_api_key_secret,
      });
    }
    if (credPairs.length === 0) {
      return {
        ok: false,
        reason: "no_subaccount",
        error: "Twilio credentials are missing (auth token or API Key)",
      };
    }
    let lastError = "";
    for (const cred of credPairs) {
      try {
        const client = twilio(cred.username, cred.password, {
          accountSid: settings.account_sid,
        });
        const numbers = await client.incomingPhoneNumbers.list({
          phoneNumber: settings.from_number,
          limit: 1,
        });
        if (numbers.length === 0) {
          lastError = `Number ${settings.from_number} not found on Twilio account`;
          continue;
        }
        return {
          ok: true,
          accountSid: settings.account_sid,
          authUsername: cred.username,
          authPassword: cred.password,
          authToken: cred.authToken ?? "",
          phoneNumber: settings.from_number,
          phoneNumberSid: numbers[0].sid,
        };
      } catch (e) {
        lastError = (e as Error).message || "Twilio lookup failed";
      }
    }
    return { ok: false, reason: "lookup_failed", error: lastError };
  }

  if (!company.twilio_subaccount_sid) {
    return { ok: false, reason: "no_subaccount" };
  }
  return { ok: false, reason: "no_number" };
}

export async function checkVoiceCapability(
  company: Parameters<typeof resolveCallingContext>[0],
  settings: MessagingSettings
): Promise<
  | { ok: true; voice: boolean; phoneNumber: string }
  | { ok: false; error: string }
> {
  const ctx = await resolveCallingContext(company, settings);
  if (!ctx.ok) {
    return {
      ok: false,
      error:
        ctx.error ??
        (ctx.reason === "no_subaccount"
          ? "Tenant has no Twilio subaccount"
          : "Tenant has no dedicated business number"),
    };
  }
  try {
    const client = twilio(ctx.authUsername, ctx.authPassword, {
      accountSid: ctx.accountSid,
    });
    const num = await client
      .incomingPhoneNumbers(ctx.phoneNumberSid)
      .fetch();
    return { ok: true, voice: num.capabilities.voice === true, phoneNumber: ctx.phoneNumber };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Lookup failed" };
  }
}

export function getAppBaseUrl(req?: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (req) {
    const url = new URL(req.url);
    const proto =
      req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    return `${proto}://${host}`;
  }
  return "";
}

// One-click activation: idempotently create the API Key + TwiML App on the
// tenant's subaccount, point the dedicated number's voice webhook at our
// inbound handler, and persist everything onto messaging_settings. Safe to
// re-run after a partial failure -- each step checks for existing state
// before creating.
export async function enableVoiceForCompany(args: {
  companyId: number;
  appBaseUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { companyId, appBaseUrl } = args;
  if (!appBaseUrl) {
    return {
      ok: false,
      error: "App base URL is not configured (NEXT_PUBLIC_APP_URL)",
    };
  }

  const db = await getDb();
  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(companyId);
  if (!company) return { ok: false, error: "Company not found" };

  // Load any partially-persisted settings so we can resume after a failed run
  // and so legacy contexts can be resolved from messaging_settings.
  const existing = await getVoiceSettings(companyId);

  const ctx = await resolveCallingContext(company, existing);
  if (!ctx.ok) {
    return {
      ok: false,
      error:
        ctx.error ??
        (ctx.reason === "no_subaccount"
          ? "Connect Twilio first (Settings → Messaging)"
          : "Complete 10DLC registration in Settings → Messaging first"),
    };
  }

  const outboundUrl = `${appBaseUrl}/api/voice/outbound`;
  const inboundUrl = `${appBaseUrl}/api/voice/inbound`;
  const statusUrl = `${appBaseUrl}/api/voice/status`;

  const client = twilio(ctx.authUsername, ctx.authPassword, {
    accountSid: ctx.accountSid,
  });

  // 1. TwiML App -- the SID the Voice SDK uses for outbound calls.
  let twimlAppSid = existing.voice_twiml_app_sid;
  if (twimlAppSid) {
    try {
      await client.applications(twimlAppSid).update({
        voiceUrl: outboundUrl,
        voiceMethod: "POST",
        statusCallback: statusUrl,
        statusCallbackMethod: "POST",
      });
    } catch {
      // The stored SID may have been deleted in Twilio -- fall through to
      // re-create.
      twimlAppSid = null;
    }
  }
  if (!twimlAppSid) {
    try {
      const created = await client.applications.create({
        friendlyName: `nick360 voice ${companyId}`.slice(0, 64),
        voiceUrl: outboundUrl,
        voiceMethod: "POST",
        statusCallback: statusUrl,
        statusCallbackMethod: "POST",
      });
      twimlAppSid = created.sid;
    } catch (e) {
      return {
        ok: false,
        error: `Could not create TwiML App: ${(e as Error).message}`,
      };
    }
  }

  // 2. API Key -- credential the Voice SDK access token is signed with. The
  //    Secret is only returned once at creation, so we never re-fetch; if the
  //    stored secret is missing we always create a fresh key.
  let apiKeySid = existing.voice_api_key_sid;
  let apiKeySecret = existing.voice_api_key_secret;
  if (!apiKeySid || !apiKeySecret) {
    try {
      const key = await client.newKeys.create({
        friendlyName: `nick360 voice ${companyId}`.slice(0, 64),
      });
      apiKeySid = key.sid;
      apiKeySecret = key.secret;
    } catch (e) {
      return {
        ok: false,
        error: `Could not create API Key: ${(e as Error).message}`,
      };
    }
  }

  // 3. Point the dedicated number's voice webhook at our inbound handler.
  try {
    await client.incomingPhoneNumbers(ctx.phoneNumberSid).update({
      voiceUrl: inboundUrl,
      voiceMethod: "POST",
      statusCallback: statusUrl,
      statusCallbackMethod: "POST",
    });
  } catch (e) {
    return {
      ok: false,
      error: `Could not update number voice webhook: ${(e as Error).message}`,
    };
  }

  // 4. Persist everything onto messaging_settings so the existing voice
  //    routes (token, outbound TwiML) pick it up. Upsert so this works
  //    whether or not the row already existed. Preserve any existing
  //    auth_token if the new context didn't include one (API-key-only
  //    legacy path) -- we don't want to wipe out a working credential.
  const nextAuthToken = ctx.authToken || existing.auth_token;
  if (existing.id) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET account_sid = ?, auth_token = ?, from_number = ?,
                voice_api_key_sid = ?, voice_api_key_secret = ?,
                voice_twiml_app_sid = ?, voice_capability_verified = 1,
                updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(
        ctx.accountSid,
        nextAuthToken,
        ctx.phoneNumber,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        existing.id,
        companyId
      );
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, account_sid, auth_token, from_number,
            voice_api_key_sid, voice_api_key_secret, voice_twiml_app_sid,
            voice_record_calls, voice_capability_verified, updated_at)
         VALUES (?, 'twilio', ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))`
      )
      .run(
        companyId,
        ctx.accountSid,
        nextAuthToken,
        ctx.phoneNumber,
        apiKeySid,
        apiKeySecret,
        twimlAppSid
      );
  }

  return { ok: true };
}

// Reverse of enable: clears the persisted voice config so the Voice SDK can
// no longer issue tokens. The Twilio-side API Key + TwiML App are left in
// place so the next enable can re-bind to them; nothing on Twilio's side
// costs money while idle.
export async function disableVoiceForCompany(
  companyId: number
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE messaging_settings
          SET voice_api_key_sid = NULL,
              voice_api_key_secret = NULL,
              voice_twiml_app_sid = NULL,
              updated_at = datetime('now')
        WHERE company_id = ?`
    )
    .run(companyId);
}

// Persist the caller-ID Business Name. Real CNAM propagation through carriers
// requires a paid Twilio CNAME registration we don't run today, so for now
// this stores the name and best-effort updates the number's friendlyName.
export async function setVoiceCallerIdName(args: {
  companyId: number;
  name: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = args.name.trim();
  if (trimmed.length > 15) {
    return { ok: false, error: "Business Name must be 15 characters or fewer" };
  }
  if (trimmed && !/^[A-Za-z0-9 ]+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Use letters, numbers, and spaces only",
    };
  }
  const db = await getDb();
  const settings = await getVoiceSettings(args.companyId);
  const value = trimmed || null;
  if (settings.id) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET voice_caller_id_name = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(value, settings.id, args.companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, voice_caller_id_name, updated_at)
         VALUES (?, 'twilio', ?, datetime('now'))`
      )
      .run(args.companyId, value);
  }
  return { ok: true };
}

export async function setVoicemailGreeting(args: {
  companyId: number;
  dataUrl: string | null;
}): Promise<void> {
  const db = await getDb();
  const settings = await getVoiceSettings(args.companyId);
  if (settings.id) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET voice_voicemail_greeting_data_url = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(args.dataUrl, settings.id, args.companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, voice_voicemail_greeting_data_url, updated_at)
         VALUES (?, 'twilio', ?, datetime('now'))`
      )
      .run(args.companyId, args.dataUrl);
  }
}

export async function setVoiceCapabilityVerified(
  companyId: number
): Promise<void> {
  const db = await getDb();
  const settings = await getVoiceSettings(companyId);
  if (settings.id) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET voice_capability_verified = 1, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(settings.id, companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, voice_capability_verified, updated_at)
         VALUES (?, 'twilio', 1, datetime('now'))`
      )
      .run(companyId);
  }
}
