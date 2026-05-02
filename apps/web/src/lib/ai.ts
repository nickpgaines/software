import Anthropic from "@anthropic-ai/sdk";
import { getDb, type AiSettings, type Customer, type Message } from "@/lib/db";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function getAiSettings(): Promise<AiSettings> {
  const db = await getDb();
  // Wrap in a write transaction to force a primary read. Plain reads can hit
  // a Turso edge replica that lags behind the primary right after a save.
  return await db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT * FROM ai_settings WHERE id = 1")
      .get()) as AiSettings | undefined;
    return (
      row ?? {
        id: 1,
        company_id: 1,
        provider: "anthropic",
        api_key: null,
        model: DEFAULT_MODEL,
        company_voice: null,
        updated_at: "",
      }
    );
  });
}

export function isAiConfigured(s: AiSettings): boolean {
  return !!s.api_key;
}

type Company = {
  name: string | null;
  address: string | null;
  phone: string | null;
};

async function getCompany(): Promise<Company> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT name, address, phone FROM company WHERE id = 1")
    .get()) as Company | undefined;
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
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function draftSmsReply(args: {
  settings: AiSettings;
  customer: Customer;
  messages: Message[];
}): Promise<DraftReplyResult> {
  if (!isAiConfigured(args.settings)) {
    return { ok: false, error: "AI is not configured" };
  }
  const business = await getCompany();
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

  const client = new Anthropic({ apiKey: args.settings.api_key! });
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
      return { ok: false, error: "Empty response from Claude" };
    }
    return { ok: true, text };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Invalid Anthropic API key." };
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
