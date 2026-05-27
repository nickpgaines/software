import { NextResponse } from "next/server";
import { getDb, type EmailSettings } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { resolveEmailSender } from "@/lib/email";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

type PublicEmailSettings = {
  provider: string;
  api_key_set: boolean;
  api_key_prefix: string | null;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  configured: boolean;
  // The address mail actually goes out as (a tenant's own from-address, or the
  // shared platform domain). `using_platform` is true when sending on the
  // shared Forge domain rather than a tenant's own connected Resend.
  effective_from: string | null;
  using_platform: boolean;
};

function toPublic(
  s: EmailSettings,
  eff: {
    configured: boolean;
    effective_from: string | null;
    using_platform: boolean;
  }
): PublicEmailSettings {
  return {
    provider: s.provider,
    api_key_set: !!s.api_key,
    api_key_prefix:
      s.api_key && s.api_key.length >= 6 ? s.api_key.slice(0, 6) : null,
    from_address: s.from_address,
    from_name: s.from_name,
    reply_to: s.reply_to,
    configured: eff.configured,
    effective_from: eff.effective_from,
    using_platform: eff.using_platform,
  };
}

async function readSettings(companyId: number): Promise<EmailSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Plain reads can hit
  // a Turso edge replica that lags behind the primary, which made the page
  // flip back to "Not connected" right after a successful save.
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT * FROM email_settings WHERE company_id = ? LIMIT 1")
      .get(companyId)) as EmailSettings | undefined;
    return (
      row ?? {
        id: 0,
        company_id: companyId,
        provider: "resend",
        api_key: null,
        from_address: null,
        from_name: null,
        reply_to: null,
        platform_local_part: null,
        updated_at: "",
      }
    );
  });
}

export async function GET() {
  const companyId = await requireCompanyId();
  const s = await readSettings(companyId);
  const sender = await resolveEmailSender(companyId);
  return NextResponse.json(
    toPublic(s, {
      configured: !!sender,
      effective_from: sender?.fromAddress ?? null,
      using_platform: !!sender?.viaPlatform,
    }),
    { headers: NO_CACHE_HEADERS }
  );
}

export async function PUT(req: Request) {
  const companyId = await requireCompanyId();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    api_key: string;
    from_address: string;
    from_name: string;
    reply_to: string;
  }>;

  const apiKey = (body.api_key || "").trim();
  const fromAddress = (body.from_address || "").trim();
  const fromName = (body.from_name || "").trim();
  const replyTo = (body.reply_to || "").trim();

  if (fromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    return NextResponse.json(
      { error: "From address must be a valid email." },
      { status: 400 }
    );
  }
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    return NextResponse.json(
      { error: "Reply-to must be a valid email." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const current = await readSettings(companyId);

  const nextKey = apiKey || current.api_key;
  const nextFromAddress = fromAddress || current.from_address;
  const nextFromName =
    typeof body.from_name === "string"
      ? fromName || null
      : current.from_name;
  const nextReplyTo =
    typeof body.reply_to === "string" ? replyTo || null : current.reply_to;

  if (!nextKey || !nextFromAddress) {
    const missing: string[] = [];
    if (!nextKey) missing.push("API key");
    if (!nextFromAddress) missing.push("From address");
    return NextResponse.json(
      { error: `Please fill in: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  // Upsert this tenant's row. There's no UNIQUE on company_id (predates
  // multi-tenancy), so we test-and-update instead of relying on ON CONFLICT.
  if (current.id) {
    await db
      .prepare(
        `UPDATE email_settings
            SET api_key = ?, from_address = ?, from_name = ?, reply_to = ?,
                updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(nextKey, nextFromAddress, nextFromName, nextReplyTo, current.id, companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO email_settings
           (company_id, provider, api_key, from_address, from_name, reply_to, updated_at)
         VALUES (?, 'resend', ?, ?, ?, ?, datetime('now'))`
      )
      .run(companyId, nextKey, nextFromAddress, nextFromName, nextReplyTo);
  }

  const updated: EmailSettings = {
    id: current.id || 0,
    company_id: companyId,
    provider: current.provider || "resend",
    api_key: nextKey,
    from_address: nextFromAddress,
    from_name: nextFromName,
    reply_to: nextReplyTo,
    platform_local_part: current.platform_local_part,
    updated_at: new Date().toISOString(),
  };
  // A successful PUT always sets a tenant's own key + from-address, so the
  // effective sender is their own connected Resend, not the shared domain.
  return NextResponse.json(
    toPublic(updated, {
      configured: true,
      effective_from: nextFromAddress,
      using_platform: false,
    }),
    { headers: NO_CACHE_HEADERS }
  );
}
