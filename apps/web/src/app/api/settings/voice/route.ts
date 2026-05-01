import { NextResponse } from "next/server";
import { getDb, type MessagingSettings } from "@/lib/db";

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
};

function mask(sid: string | null): string | null {
  if (!sid) return null;
  if (sid.length < 8) return sid;
  return `${sid.slice(0, 4)}…${sid.slice(-4)}`;
}

function toPublic(s: MessagingSettings): PublicVoiceSettings {
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
  };
}

async function readSettings(): Promise<MessagingSettings> {
  const db = await getDb();
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

export async function GET() {
  const s = await readSettings();
  return NextResponse.json(toPublic(s), { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: Request) {
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
  const current = await readSettings();

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

  await db
    .prepare(
      `INSERT INTO messaging_settings
         (id, provider, voice_api_key_sid, voice_api_key_secret,
          voice_twiml_app_sid, voice_record_calls, updated_at)
       VALUES (1, 'twilio', ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         voice_api_key_sid    = excluded.voice_api_key_sid,
         voice_api_key_secret = excluded.voice_api_key_secret,
         voice_twiml_app_sid  = excluded.voice_twiml_app_sid,
         voice_record_calls   = excluded.voice_record_calls,
         updated_at           = excluded.updated_at`
    )
    .run(nextSid, nextSecret, nextApp, nextRecord);

  const updated: MessagingSettings = {
    ...current,
    voice_api_key_sid: nextSid,
    voice_api_key_secret: nextSecret,
    voice_twiml_app_sid: nextApp,
    voice_record_calls: nextRecord,
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json(toPublic(updated), { headers: NO_CACHE_HEADERS });
}
