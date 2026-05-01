import crypto from "node:crypto";
import {
  getDb,
  type Customer,
  type EmailAudience,
  type EmailSettings,
} from "@/lib/db";

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function getEmailSettings(): Promise<EmailSettings> {
  const db = await getDb();
  // Plain read with one-shot retry: matches the pattern that worked
  // reliably for voice settings. Turso replicas can briefly serve stale
  // data after a write, but a re-read typically lands on primary.
  let row = (await db
    .prepare("SELECT * FROM email_settings WHERE id = 1")
    .get()) as EmailSettings | undefined;
  if (row && !row.api_key) {
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

export function isEmailConfigured(s: EmailSettings): boolean {
  return !!(s.api_key && s.from_address);
}

const TOKEN_SECRET_FALLBACK = "dev-secret-change-me";

function tokenSecret(): string {
  return process.env.SESSION_SECRET?.trim() || TOKEN_SECRET_FALLBACK;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Buffer {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function buildUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const sig = crypto
    .createHmac("sha256", tokenSecret())
    .update(normalized)
    .digest();
  return `${base64url(normalized)}.${base64url(sig)}`;
}

export function verifyUnsubscribeToken(
  token: string
): { ok: true; email: string } | { ok: false } {
  const dot = token.indexOf(".");
  if (dot < 1) return { ok: false };
  let email: string;
  let sig: Buffer;
  try {
    email = fromBase64url(token.slice(0, dot)).toString("utf8");
    sig = fromBase64url(token.slice(dot + 1));
  } catch {
    return { ok: false };
  }
  const expected = crypto
    .createHmac("sha256", tokenSecret())
    .update(email)
    .digest();
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(sig, expected)
  ) {
    return { ok: false };
  }
  return { ok: true, email };
}

export type AudienceRecipient = {
  customer_id: number | null;
  email: string;
  name: string | null;
};

export async function fetchAudience(
  audience: EmailAudience
): Promise<AudienceRecipient[]> {
  const db = await getDb();
  // All audiences exclude unsubscribed addresses + require a non-empty email.
  const baseFilter = `c.email IS NOT NULL
    AND TRIM(c.email) != ''
    AND NOT EXISTS (
      SELECT 1 FROM email_unsubscribes u
       WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(c.email))
    )`;

  let sql: string;
  if (audience === "all_customers") {
    sql = `
      SELECT c.id AS customer_id, c.email, c.name
        FROM customers c
       WHERE ${baseFilter}
       ORDER BY c.id`;
  } else if (audience === "active_subscribers") {
    sql = `
      SELECT DISTINCT c.id AS customer_id, c.email, c.name
        FROM customers c
        JOIN customer_subscriptions s
          ON s.customer_id = c.id AND s.status = 'active'
       WHERE ${baseFilter}
       ORDER BY c.id`;
  } else if (audience === "non_subscribers") {
    sql = `
      SELECT c.id AS customer_id, c.email, c.name
        FROM customers c
       WHERE ${baseFilter}
         AND NOT EXISTS (
           SELECT 1 FROM customer_subscriptions s
            WHERE s.customer_id = c.id AND s.status = 'active'
         )
       ORDER BY c.id`;
  } else if (audience === "prospects") {
    sql = `
      SELECT DISTINCT c.id AS customer_id, c.email, c.name
        FROM customers c
        JOIN estimates e ON e.customer_id = c.id
       WHERE ${baseFilter}
         AND NOT EXISTS (
           SELECT 1 FROM jobs j
            WHERE j.customer_id = c.id
              AND j.status = 'completed'
         )
       ORDER BY c.id`;
  } else {
    return [];
  }
  const rows = (await db.prepare(sql).all()) as Array<
    Pick<Customer, "name"> & { customer_id: number; email: string }
  >;
  return rows.map((r) => ({
    customer_id: r.customer_id,
    email: r.email,
    name: r.name,
  }));
}

export async function countAudience(audience: EmailAudience): Promise<number> {
  const recipients = await fetchAudience(audience);
  return recipients.length;
}

type EmailSendInput = {
  settings: EmailSettings;
  to: string;
  subject: string;
  html: string;
  text?: string;
  unsubscribeUrl?: string;
  replyTo?: string;
};

// Resend single-email send via REST.
export async function sendEmailViaResend(
  input: EmailSendInput
): Promise<SendEmailResult> {
  const { settings, to, subject, html, text, unsubscribeUrl, replyTo } = input;
  if (!isEmailConfigured(settings)) {
    return { ok: false, error: "Email is not configured" };
  }
  const fromValue = settings.from_name
    ? `${settings.from_name} <${settings.from_address}>`
    : settings.from_address!;
  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromValue,
        to: [to],
        subject,
        html,
        text,
        reply_to: replyTo || settings.reply_to || undefined,
        headers: Object.keys(headers).length ? headers : undefined,
      }),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Network error" };
  }
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.name || `Resend error ${res.status}`,
    };
  }
  return { ok: true, id: data.id || "" };
}

export type CompanyContact = {
  name: string | null;
  address: string | null;
};

export async function getCompanyForFooter(): Promise<CompanyContact> {
  const db = await getDb();
  const row = (await db
    .prepare("SELECT name, address FROM company WHERE id = 1")
    .get()) as { name: string | null; address: string | null } | undefined;
  return row ?? { name: null, address: null };
}

// Append an unsubscribe link + physical address to the HTML body so every
// blast meets CAN-SPAM. The footer is plain inline-styled to render in most
// clients without external CSS.
export function applyEmailFooter(args: {
  bodyHtml: string;
  unsubscribeUrl: string;
  company: CompanyContact;
}): string {
  const { bodyHtml, unsubscribeUrl, company } = args;
  const companyLine = [company.name, company.address]
    .filter((v) => v && String(v).trim() !== "")
    .map((v) => escapeHtml(String(v)))
    .join(" · ");

  const footer = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      ${companyLine ? `<div>${companyLine}</div>` : ""}
      <div style="margin-top:6px;">
        Don't want these emails?
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a>.
      </div>
    </div>
  `;
  return `${bodyHtml}${footer}`;
}

export function buildPlainTextFallback(html: string): string {
  // Cheap HTML -> text. Strips tags, decodes a few entities, trims whitespace.
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = noStyle
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
