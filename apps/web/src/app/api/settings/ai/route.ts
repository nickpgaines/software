import { NextResponse } from "next/server";
import { getDb, type AiSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

const ALLOWED_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-haiku-4-5",
];

type PublicAiSettings = {
  provider: string;
  api_key_set: boolean;
  api_key_prefix: string | null;
  model: string;
  company_voice: string | null;
  configured: boolean;
};

function toPublic(s: AiSettings): PublicAiSettings {
  return {
    provider: s.provider,
    api_key_set: !!s.api_key,
    api_key_prefix:
      s.api_key && s.api_key.length >= 8 ? s.api_key.slice(0, 8) : null,
    model: s.model || "claude-sonnet-4-6",
    company_voice: s.company_voice,
    configured: !!s.api_key,
  };
}

async function readSettings(): Promise<AiSettings> {
  const db = await getDb();
  let row = (await db
    .prepare("SELECT * FROM ai_settings WHERE id = 1")
    .get()) as AiSettings | undefined;
  if (row && !row.api_key) {
    const retry = (await db
      .prepare("SELECT * FROM ai_settings WHERE id = 1")
      .get()) as AiSettings | undefined;
    if (retry) row = retry;
  }
  return (
    row ?? {
      id: 1,
      provider: "anthropic",
      api_key: null,
      model: "claude-sonnet-4-6",
      company_voice: null,
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
    model: string;
    company_voice: string;
  }>;

  const apiKey = (body.api_key || "").trim();
  const model = (body.model || "").trim();
  const voice = (body.company_voice || "").trim();

  if (apiKey && !/^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(apiKey)) {
    return NextResponse.json(
      { error: "Anthropic API key should start with sk-ant-." },
      { status: 400 }
    );
  }
  if (model && !ALLOWED_MODELS.includes(model)) {
    return NextResponse.json(
      { error: `Model must be one of: ${ALLOWED_MODELS.join(", ")}.` },
      { status: 400 }
    );
  }

  const db = await getDb();
  const current = await readSettings();

  const nextKey = apiKey || current.api_key;
  const nextModel = model || current.model || "claude-sonnet-4-6";
  const nextVoice =
    typeof body.company_voice === "string"
      ? voice || null
      : current.company_voice;

  if (!nextKey) {
    return NextResponse.json(
      { error: "Please provide an Anthropic API key." },
      { status: 400 }
    );
  }

  await db
    .prepare(
      `INSERT INTO ai_settings
         (id, provider, api_key, model, company_voice, updated_at)
       VALUES (1, 'anthropic', ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         api_key       = excluded.api_key,
         model         = excluded.model,
         company_voice = excluded.company_voice,
         updated_at    = excluded.updated_at`
    )
    .run(nextKey, nextModel, nextVoice);

  const updated: AiSettings = {
    id: 1,
    provider: "anthropic",
    api_key: nextKey,
    model: nextModel,
    company_voice: nextVoice,
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json(toPublic(updated), { headers: NO_CACHE_HEADERS });
}
