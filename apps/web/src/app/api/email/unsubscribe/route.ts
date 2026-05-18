import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/email";

export const dynamic = "force-dynamic";

const HTML_HEADERS = { "Content-Type": "text/html" } as const;

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no"><title>${title}</title><style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 48px 16px; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    h1 { margin: 0 0 12px; font-size: 20px; }
    p { margin: 0 0 8px; color: #475569; }
  </style></head><body><div class="card">${body}</div></body></html>`;
}

async function unsubscribe(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return new NextResponse(
      page(
        "Unsubscribe link invalid",
        `<h1>Link invalid</h1><p>This unsubscribe link is invalid or has expired. If you received this in error, please reply to the email and we'll remove you manually.</p>`
      ),
      { status: 400, headers: HTML_HEADERS }
    );
  }
  const email = verified.email;
  const companyId = verified.companyId;
  const db = await getDb();
  // Per-tenant unsubscribe: a customer can opt out of one tenant's blasts
  // without affecting another's. The schema (post-migration) carries a
  // (company_id, email) UNIQUE index so the upsert is per-tenant.
  await db
    .prepare(
      `INSERT INTO email_unsubscribes (company_id, email, source)
       VALUES (?, ?, 'one-click')
       ON CONFLICT(company_id, email) DO UPDATE SET unsubscribed_at = datetime('now')`
    )
    .run(companyId, email);
  return new NextResponse(
    page(
      "Unsubscribed",
      `<h1>You're unsubscribed</h1><p>${email} won't receive any more email blasts from us. If this was a mistake, reply to one of our previous emails and we'll add you back.</p>`
    ),
    { status: 200, headers: HTML_HEADERS }
  );
}

export async function GET(req: Request) {
  return unsubscribe(req);
}

// One-Click Unsubscribe (RFC 8058) — Gmail and others POST here.
export async function POST(req: Request) {
  return unsubscribe(req);
}
