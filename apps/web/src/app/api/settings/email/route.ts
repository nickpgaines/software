import { NextResponse } from "next/server";
import { getDb, type EmailSettings } from "@/lib/db";

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
};

function toPublic(s: EmailSettings): PublicEmailSettings {
  return {
    provider: s.provider,
    api_key_set: !!s.api_key,
    api_key_prefix:
      s.api_key && s.api_key.length >= 6 ? s.api_key.slice(0, 6) : null,
    from_address: s.from_address,
    from_name: s.from_name,
    reply_to: s.reply_to,
    configured: !!(s.api_key && s.from_address),
  };
}

async function readSettings(): Promise<EmailSettings> {
  const db = await getDb();
  let row = (await db
    .prepare("SELECT * FROM email_settings WHERE id = 1")
    .get()) as EmailSettings | undefined;
  if (row && !row.api_key && !row.from_address) {
    const retry = (await db
      .prepare("SELECT * FROM email_settings WHERE id = 1")
      .get()) as EmailSettings | undefined;
    if (retry) row = retry;
  }
  return (
    row ?? {
      id: 1,
      provider: "resend",
      api_key: null,
      from_address: null,
      from_name: null,
      reply_to: null,
      updated_at: "",
    }
  );
}

export async function GET() {
  const s = await readSettings();
  return NextResponse.json(toPublic(s), { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: Request) {
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
  const current = await readSettings();

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

  await db
    .prepare(
      `INSERT INTO email_settings
         (id, provider, api_key, from_address, from_name, reply_to, updated_at)
       VALUES (1, 'resend', ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         api_key      = excluded.api_key,
         from_address = excluded.from_address,
         from_name    = excluded.from_name,
         reply_to     = excluded.reply_to,
         updated_at   = excluded.updated_at`
    )
    .run(nextKey, nextFromAddress, nextFromName, nextReplyTo);

  const updated: EmailSettings = {
    id: 1,
    provider: current.provider || "resend",
    api_key: nextKey,
    from_address: nextFromAddress,
    from_name: nextFromName,
    reply_to: nextReplyTo,
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json(toPublic(updated), { headers: NO_CACHE_HEADERS });
}
