import { NextResponse } from "next/server";
import { getDb, type Company, type MessagingSettings } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { emptyVoiceSettings } from "@/lib/voice";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

type PublicVoiceSettings = {
  api_key_sid_masked: string | null;
  api_key_secret_set: boolean;
  twiml_app_sid_masked: string | null;
  record_calls: boolean;
  configured: boolean;
  has_account_credentials: boolean;
  has_business_number: boolean;
  business_number: string | null;
  has_dedicated_number: boolean;
  dedicated_number: string | null;
  capability_verified: boolean;
  caller_id_name: string | null;
  has_voicemail_greeting: boolean;
};

function mask(sid: string | null): string | null {
  if (!sid) return null;
  if (sid.length < 8) return sid;
  return `${sid.slice(0, 4)}…${sid.slice(-4)}`;
}

function toPublic(
  s: MessagingSettings,
  company: Company | null
): PublicVoiceSettings {
  return {
    api_key_sid_masked: mask(s.voice_api_key_sid),
    api_key_secret_set: !!s.voice_api_key_secret,
    twiml_app_sid_masked: mask(s.voice_twiml_app_sid),
    record_calls: s.voice_record_calls === 1,
    configured: !!(
      s.voice_api_key_sid &&
      s.voice_api_key_secret &&
      s.voice_twiml_app_sid &&
      s.account_sid &&
      s.from_number
    ),
    has_account_credentials: !!(s.account_sid && s.auth_token),
    has_business_number: !!s.from_number,
    business_number: s.from_number,
    has_dedicated_number: !!(
      company?.sms_dedicated_number && company?.sms_dedicated_number_sid
    ),
    dedicated_number: company?.sms_dedicated_number ?? null,
    capability_verified: s.voice_capability_verified === 1,
    caller_id_name: s.voice_caller_id_name,
    has_voicemail_greeting: !!s.voice_voicemail_greeting_data_url,
  };
}

async function readSettings(companyId: number): Promise<MessagingSettings> {
  const db = await getDb();
  // Run the read twice if the first response looks empty -- libsql HTTP clients
  // can briefly land on a stale Turso replica after a write, but a second
  // request typically re-routes and sees the just-written row.
  let row = (await db
    .prepare("SELECT * FROM messaging_settings WHERE company_id = ? LIMIT 1")
    .get(companyId)) as MessagingSettings | undefined;
  if (
    row &&
    !row.voice_api_key_sid &&
    !row.voice_api_key_secret &&
    !row.voice_twiml_app_sid
  ) {
    const retry = (await db
      .prepare("SELECT * FROM messaging_settings WHERE company_id = ? LIMIT 1")
      .get(companyId)) as MessagingSettings | undefined;
    if (retry) row = retry;
  }
  return row ?? emptyVoiceSettings(companyId);
}

async function readCompany(companyId: number): Promise<Company | null> {
  const db = await getDb();
  return (
    (await db
      .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
      .get<Company>(companyId)) ?? null
  );
}

export async function GET() {
  const companyId = await requireCompanyId();
  const [s, company] = await Promise.all([
    readSettings(companyId),
    readCompany(companyId),
  ]);
  return NextResponse.json(toPublic(s, company), { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: Request) {
  const companyId = await requireCompanyId();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    api_key_sid: string;
    api_key_secret: string;
    twiml_app_sid: string;
    record_calls: boolean;
  }>;

  const sid = (body.api_key_sid || "").trim();
  const secret = (body.api_key_secret || "").trim();
  const app = (body.twiml_app_sid || "").trim();

  if (sid && !/^SK[a-zA-Z0-9]{32}$/.test(sid)) {
    return NextResponse.json(
      { error: "API Key SID must look like SK followed by 32 characters." },
      { status: 400 }
    );
  }
  if (app && !/^AP[a-zA-Z0-9]{32}$/.test(app)) {
    return NextResponse.json(
      { error: "TwiML App SID must look like AP followed by 32 characters." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const current = await readSettings(companyId);

  const nextSid = sid || current.voice_api_key_sid;
  const nextSecret = secret || current.voice_api_key_secret;
  const nextApp = app || current.voice_twiml_app_sid;
  const nextRecord =
    typeof body.record_calls === "boolean"
      ? body.record_calls
        ? 1
        : 0
      : current.voice_record_calls;

  if (!nextSid || !nextSecret || !nextApp) {
    const missing: string[] = [];
    if (!nextSid) missing.push("API Key SID");
    if (!nextSecret) missing.push("API Key Secret");
    if (!nextApp) missing.push("TwiML App SID");
    return NextResponse.json(
      { error: `Please fill in: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  if (current.id) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET voice_api_key_sid = ?, voice_api_key_secret = ?,
                voice_twiml_app_sid = ?, voice_record_calls = ?,
                updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(nextSid, nextSecret, nextApp, nextRecord, current.id, companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, voice_api_key_sid, voice_api_key_secret,
            voice_twiml_app_sid, voice_record_calls, updated_at)
         VALUES (?, 'twilio', ?, ?, ?, ?, datetime('now'))`
      )
      .run(companyId, nextSid, nextSecret, nextApp, nextRecord);
  }

  const updated: MessagingSettings = {
    ...current,
    voice_api_key_sid: nextSid,
    voice_api_key_secret: nextSecret,
    voice_twiml_app_sid: nextApp,
    voice_record_calls: nextRecord,
    updated_at: new Date().toISOString(),
  };
  const company = await readCompany(companyId);
  return NextResponse.json(toPublic(updated, company), {
    headers: NO_CACHE_HEADERS,
  });
}
