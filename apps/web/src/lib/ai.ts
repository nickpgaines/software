import Anthropic from "@anthropic-ai/sdk";
import { getDb, type AiSettings, type Customer, type Message } from "@/lib/db";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MONTHLY_LIMIT = 500;

export function platformAiKey(): string | null {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k ? k : null;
}

export function isAiPlatformConfigured(): boolean {
  return !!platformAiKey();
}

export async function getAiSettings(companyId: number): Promise<AiSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Plain reads can hit
  // a Turso edge replica that lags behind the primary right after a save.
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

export function isAiConfigured(_s: AiSettings): boolean {
  return isAiPlatformConfigured();
}

function currentPeriod(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type AiUsage = {
  period: string;
  used: number;
  limit: number;
  remaining: number;
};

export function aiUsageFromSettings(s: AiSettings): AiUsage {
  const period = currentPeriod();
  const limit = s.monthly_limit > 0 ? s.monthly_limit : DEFAULT_MONTHLY_LIMIT;
  const used = s.usage_period === period ? s.usage_count : 0;
  return { period, used, limit, remaining: Math.max(0, limit - used) };
}

type Company = {
  name: string | null;
  address: string | null;
  phone: string | null;
};

async function getCompany(companyId: number): Promise<Company> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT name, address, phone FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as Company | undefined;
  return row ?? { name: null, address: null, phone: null };
}

function customerDisplayName(c: Customer): string {
  if (c.first_name && c.last_name) {
    return `${c.first_name.trim()} ${c.last_name.trim()}`.trim();
  }
  if (c.first_name) return c.first_name.trim();
  return c.name?.trim() || "the customer";
}

function customerFirstName(c: Customer): string {
  if (c.first_name && c.first_name.trim()) return c.first_name.trim();
  const fromName = c.name?.trim().split(/\s+/)[0];
  return fromName || "there";
}

function buildSystemPrompt(args: {
  business: Company;
  voice: string | null;
  customerFirstName: string;
}): string {
  const businessName = args.business.name?.trim() || "our business";
  const voice = args.voice?.trim();
  const lines: string[] = [
    `You are drafting an SMS reply on behalf of ${businessName}, a small home-services business.`,
    `You are texting back to a customer named ${args.customerFirstName}.`,
    "",
    "Style guide:",
    "- Reply in plain text only — no markdown, no emoji unless the customer used emoji first.",
    "- Keep replies concise. Aim for 1-2 short sentences. Hard cap: 320 characters.",
    "- Sound like a human texting on behalf of a small local business: friendly, direct, helpful.",
    "- Never sign off with a name or signature.",
    "- If the customer raised a problem or complaint, lead with empathy and offer a concrete next step (re-clean, refund, callback time).",
    "- If the customer asked a scheduling/availability question, suggest a specific window or ask one clarifying question to narrow it down.",
    "- If the customer is just confirming or saying thanks, keep your reply very short (a few words).",
    "- Don't promise anything you can't deliver. If unsure, propose to follow up.",
    "",
    "Output format: respond with ONLY the SMS reply text. No preamble, no quotes, no 'Here is a draft', no explanation.",
  ];
  if (voice) {
    lines.push("");
    lines.push("Additional voice / tone instructions from the business owner:");
    lines.push(voice);
  }
  return lines.join("\n");
}

function buildConversationContext(args: {
  customer: Customer;
  messages: Message[];
  businessName: string;
}): string {
  const recent = args.messages.slice(-12);
  const lines: string[] = [];
  lines.push("Conversation so far (oldest to newest):");
  if (recent.length === 0) {
    lines.push("(no prior messages — this is the first reply)");
  } else {
    const customerName = customerDisplayName(args.customer);
    for (const m of recent) {
      const speaker =
        m.direction === "inbound" ? customerName : args.businessName;
      lines.push(`${speaker}: ${m.body}`);
    }
  }
  lines.push("");
  lines.push("Draft the next reply from the business.");
  return lines.join("\n");
}

export type DraftReplyResult =
  | { ok: true; text: string; usage: AiUsage }
  | { ok: false; error: string; usage?: AiUsage; rateLimited?: boolean };

// Atomically increment usage for the current period, refusing if the tenant
// is already at their cap. Returns the post-increment usage on success.
async function reserveUsage(
  companyId: number
): Promise<{ ok: true; usage: AiUsage } | { ok: false; usage: AiUsage }> {
  const db = await getDb();
  const period = currentPeriod();
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT * FROM ai_settings WHERE company_id = ? LIMIT 1")
      .get(companyId)) as AiSettings | undefined;
    const limit =
      row && row.monthly_limit > 0 ? row.monthly_limit : DEFAULT_MONTHLY_LIMIT;
    const sameMonth = row?.usage_period === period;
    const currentCount = sameMonth ? row?.usage_count ?? 0 : 0;
    if (currentCount >= limit) {
      return {
        ok: false as const,
        usage: { period, used: currentCount, limit, remaining: 0 },
      };
    }
    const nextCount = currentCount + 1;
    if (row) {
      await tx
        .prepare(
          `UPDATE ai_settings
              SET usage_period = ?, usage_count = ?
            WHERE id = ? AND company_id = ?`
        )
        .run(period, nextCount, row.id, companyId);
    } else {
      await tx
        .prepare(
          `INSERT INTO ai_settings
             (company_id, provider, model, monthly_limit, usage_period, usage_count, updated_at)
           VALUES (?, 'anthropic', ?, ?, ?, ?, datetime('now'))`
        )
        .run(companyId, DEFAULT_MODEL, DEFAULT_MONTHLY_LIMIT, period, nextCount);
    }
    return {
      ok: true as const,
      usage: {
        period,
        used: nextCount,
        limit,
        remaining: Math.max(0, limit - nextCount),
      },
    };
  });
}

async function refundUsage(companyId: number): Promise<void> {
  const db = await getDb();
  const period = currentPeriod();
  await db
    .prepare(
      `UPDATE ai_settings
          SET usage_count = MAX(usage_count - 1, 0)
        WHERE company_id = ? AND usage_period = ?`
    )
    .run(companyId, period);
}

export async function draftSmsReply(args: {
  settings: AiSettings;
  customer: Customer;
  messages: Message[];
  companyId: number;
}): Promise<DraftReplyResult> {
  const apiKey = platformAiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "AI is not configured on this server. Ask the platform admin to set ANTHROPIC_API_KEY.",
    };
  }

  const reserved = await reserveUsage(args.companyId);
  if (!reserved.ok) {
    return {
      ok: false,
      error: `Monthly AI draft limit reached (${reserved.usage.used}/${reserved.usage.limit}). Resets on the 1st.`,
      usage: reserved.usage,
      rateLimited: true,
    };
  }

  const business = await getCompany(args.companyId);
  const businessName = business.name?.trim() || "Business";
  const system = buildSystemPrompt({
    business,
    voice: args.settings.company_voice,
    customerFirstName: customerFirstName(args.customer),
  });
  const conversation = buildConversationContext({
    customer: args.customer,
    messages: args.messages,
    businessName,
  });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: args.settings.model || DEFAULT_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: conversation }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) {
      await refundUsage(args.companyId);
      return { ok: false, error: "Empty response from Claude" };
    }
    return { ok: true, text, usage: reserved.usage };
  } catch (e) {
    await refundUsage(args.companyId);
    if (e instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        error:
          "Server-side Anthropic credentials are invalid. Contact the platform admin.",
      };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Rate limited by Anthropic. Try again shortly." };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, error: `Claude API error (${e.status}): ${e.message}` };
    }
    return { ok: false, error: (e as Error).message || "Network error" };
  }
}
