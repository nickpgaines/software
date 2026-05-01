import { NextResponse } from "next/server";
import { getDb, type MessagingSettings } from "@/lib/db";
import { normalizeUSPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

type PublicSettings = {
  provider: string;
  account_sid_masked: string | null;
  auth_token_set: boolean;
  from_number: string | null;
  configured: boolean;
  updated_at: string;
};

function toPublic(s: MessagingSettings): PublicSettings {
  const sid = s.account_sid;
  const masked =
    sid && sid.length >= 6 ? `${sid.slice(0, 4)}…${sid.slice(-4)}` : sid;
  return {
    provider: s.provider,
    account_sid_masked: masked,
    auth_token_set: !!s.auth_token,
    from_number: s.from_number,
    configured: !!(s.account_sid && s.auth_token && s.from_number),
    updated_at: s.updated_at,
  };
}

async function readSettings(): Promise<MessagingSettings> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM messaging_settings WHERE id = 1")
    .get()) as MessagingSettings | undefined;
  return (
    row ?? {
      id: 1,
      provider: "twilio",
      account_sid: null,
      auth_token: null,
      from_number: null,
      updated_at: "",
    }
  );
}

export async function GET() {
  const s = await readSettings();
  return NextResponse.json(toPublic(s));
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    account_sid: string;
    auth_token: string;
    from_number: string;
  }>;

  const sid = (body.account_sid || "").trim();
  const token = (body.auth_token || "").trim();
  const fromInput = (body.from_number || "").trim();

  if (sid && !/^AC[a-zA-Z0-9]{32}$/.test(sid)) {
    return NextResponse.json(
      { error: "Account SID must look like AC followed by 32 characters." },
      { status: 400 }
    );
  }

  let fromNormalized: string | null = null;
  if (fromInput) {
    fromNormalized = normalizeUSPhone(fromInput);
    if (!fromNormalized) {
      return NextResponse.json(
        { error: "From number must be a valid US phone number." },
        { status: 400 }
      );
    }
  }

  const db = await getDb();
  const current = await readSettings();

  const nextSid = sid || current.account_sid;
  const nextToken = token || current.auth_token;
  const nextFrom = fromNormalized || current.from_number;

  if (!nextSid || !nextToken || !nextFrom) {
    const missing: string[] = [];
    if (!nextSid) missing.push("Account SID");
    if (!nextToken) missing.push("Auth Token");
    if (!nextFrom) missing.push("From number");
    return NextResponse.json(
      {
        error: `Please fill in: ${missing.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  await db
    .prepare(
      `UPDATE messaging_settings
         SET account_sid = ?, auth_token = ?, from_number = ?, updated_at = datetime('now')
       WHERE id = 1`
    )
    .run(nextSid, nextToken, nextFrom);

  const updated = await readSettings();
  return NextResponse.json(toPublic(updated));
}
