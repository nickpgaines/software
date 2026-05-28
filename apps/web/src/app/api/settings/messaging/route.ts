import { NextResponse } from "next/server";
import { getDb, type Company, type MessagingSettings } from "@/lib/db";
import { normalizeUSPhone } from "@/lib/sms";
import { requireCompanyId } from "@/lib/auth";
import { emptyVoiceSettings } from "@/lib/voice";

export const dynamic = "force-dynamic";

type PublicSettings = {
  provider: string;
  account_sid_masked: string | null;
  auth_token_set: boolean;
  from_number: string | null;
  configured: boolean;
  updated_at: string;
  // Platform-managed fields. When platform_phone_number is set, the company
  // has been auto-provisioned a number from the platform Twilio account and
  // BYO credentials are not used.
  platform_phone_number: string | null;
  platform_a2p_status: string | null;
};

function toPublic(
  s: MessagingSettings,
  platform: { phone: string | null; a2pStatus: string | null }
): PublicSettings {
  const sid = s.account_sid;
  const masked =
    sid && sid.length >= 6 ? `${sid.slice(0, 4)}…${sid.slice(-4)}` : sid;
  const platformConfigured = !!platform.phone;
  const byoConfigured = !!(s.account_sid && s.auth_token && s.from_number);
  return {
    provider: s.provider,
    account_sid_masked: masked,
    auth_token_set: !!s.auth_token,
    from_number: s.from_number,
    configured: platformConfigured || byoConfigured,
    updated_at: s.updated_at,
    platform_phone_number: platform.phone,
    platform_a2p_status: platform.a2pStatus,
  };
}

async function readPlatformFields(companyId: number): Promise<{
  phone: string | null;
  a2pStatus: string | null;
}> {
  const db = await getDb();
  const row = await db
    .prepare(
      "SELECT platform_phone_number, a2p_campaign_status FROM company WHERE id = ? LIMIT 1"
    )
    .get<Pick<Company, "platform_phone_number" | "a2p_campaign_status">>(
      companyId
    );
  return {
    phone: row?.platform_phone_number ?? null,
    a2pStatus: row?.a2p_campaign_status ?? null,
  };
}

async function readSettings(companyId: number): Promise<MessagingSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Plain reads can hit
  // a Turso edge replica that lags behind the primary.
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare(
        "SELECT * FROM messaging_settings WHERE company_id = ? LIMIT 1"
      )
      .get(companyId)) as MessagingSettings | undefined;
    return row ?? emptyVoiceSettings(companyId);
  });
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

export async function GET() {
  const companyId = await requireCompanyId();
  const s = await readSettings(companyId);
  const platform = await readPlatformFields(companyId);
  return NextResponse.json(toPublic(s, platform), {
    headers: NO_CACHE_HEADERS,
  });
}

export async function PUT(req: Request) {
  const companyId = await requireCompanyId();
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
  const current = await readSettings(companyId);

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

  if (current.id) {
    await db
      .prepare(
        `UPDATE messaging_settings
            SET account_sid = ?, auth_token = ?, from_number = ?,
                updated_at  = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(nextSid, nextToken, nextFrom, current.id, companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO messaging_settings
           (company_id, provider, account_sid, auth_token, from_number, updated_at)
         VALUES (?, 'twilio', ?, ?, ?, datetime('now'))`
      )
      .run(companyId, nextSid, nextToken, nextFrom);
  }

  // Build the response from the values we just wrote. Reading back via a
  // separate query can hit a Turso replica that hasn't caught up yet, which
  // would briefly report the row as unconfigured even though the write
  // succeeded.
  const updated: MessagingSettings = {
    ...current,
    id: current.id || 0,
    company_id: companyId,
    provider: current.provider || "twilio",
    account_sid: nextSid,
    auth_token: nextToken,
    from_number: nextFrom,
    updated_at: new Date().toISOString(),
  };
  const platform = await readPlatformFields(companyId);
  return NextResponse.json(toPublic(updated, platform), {
    headers: NO_CACHE_HEADERS,
  });
}
