import { NextResponse } from "next/server";
import { getDb, type AiSettings } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { aiUsageFromSettings, isAiPlatformConfigured } from "@/lib/ai";

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

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MONTHLY_LIMIT = 500;

type PublicAiSettings = {
  provider: string;
  model: string;
  company_voice: string | null;
  configured: boolean;
  managed: true;
  usage: {
    period: string;
    used: number;
    limit: number;
    remaining: number;
  };
};

function toPublic(s: AiSettings): PublicAiSettings {
  return {
    provider: s.provider,
    model: s.model || DEFAULT_MODEL,
    company_voice: s.company_voice,
    configured: isAiPlatformConfigured(),
    managed: true,
    usage: aiUsageFromSettings(s),
  };
}

async function readSettings(companyId: number): Promise<AiSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Plain reads can hit
  // a Turso edge replica that lags behind the primary, which made the page
  // flip back to "Not connected" right after a successful save.
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT * FROM ai_settings WHERE company_id = ? LIMIT 1")
      .get(companyId)) as AiSettings | undefined;
    return (
      row ?? {
        id: 0,
        company_id: companyId,
        provider: "anthropic",
        api_key: null,
        model: DEFAULT_MODEL,
        company_voice: null,
        monthly_limit: DEFAULT_MONTHLY_LIMIT,
        usage_period: null,
        usage_count: 0,
        updated_at: "",
      }
    );
  });
}

export async function GET() {
  const companyId = await requireCompanyId();
  const s = await readSettings(companyId);
  return NextResponse.json(toPublic(s), { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: Request) {
  const companyId = await requireCompanyId();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    model: string;
    company_voice: string;
  }>;

  const model = (body.model || "").trim();
  const voice = (body.company_voice || "").trim();

  if (model && !ALLOWED_MODELS.includes(model)) {
    return NextResponse.json(
      { error: `Model must be one of: ${ALLOWED_MODELS.join(", ")}.` },
      { status: 400 }
    );
  }

  const db = await getDb();
  const current = await readSettings(companyId);

  const nextModel = model || current.model || DEFAULT_MODEL;
  const nextVoice =
    typeof body.company_voice === "string"
      ? voice || null
      : current.company_voice;

  if (current.id) {
    await db
      .prepare(
        `UPDATE ai_settings
            SET model = ?, company_voice = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?`
      )
      .run(nextModel, nextVoice, current.id, companyId);
  } else {
    await db
      .prepare(
        `INSERT INTO ai_settings
           (company_id, provider, model, company_voice, updated_at)
         VALUES (?, 'anthropic', ?, ?, datetime('now'))`
      )
      .run(companyId, nextModel, nextVoice);
  }

  const updated: AiSettings = {
    ...current,
    id: current.id || 0,
    company_id: companyId,
    provider: "anthropic",
    model: nextModel,
    company_voice: nextVoice,
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json(toPublic(updated), { headers: NO_CACHE_HEADERS });
}
