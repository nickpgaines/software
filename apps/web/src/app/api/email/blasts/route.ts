import { NextResponse } from "next/server";
import {
  applyEmailFooter,
  buildPlainTextFallback,
  buildUnsubscribeToken,
  fetchAudience,
  getCompanyForFooter,
  resolveEmailSender,
  sendEmailViaResend,
} from "@/lib/email";
import { getDb, type EmailAudience, type EmailBlast } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_AUDIENCES: EmailAudience[] = [
  "all_customers",
  "active_subscribers",
  "non_subscribers",
  "prospects",
];

function buildOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT * FROM email_blasts WHERE company_id = ? ORDER BY created_at DESC, id DESC LIMIT 200`
    )
    .all(ctx.companyId)) as EmailBlast[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const sender = await resolveEmailSender(companyId);
  if (!sender) {
    return NextResponse.json(
      { error: "Email isn't configured yet. Check Settings → Email." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    audience: EmailAudience;
    subject: string;
    body_html: string;
    body_text: string;
    test_email: string;
  }>;

  const audience = body.audience;
  const subject = (body.subject || "").trim();
  const html = (body.body_html || "").trim();
  if (!audience || !ALLOWED_AUDIENCES.includes(audience)) {
    return NextResponse.json(
      { error: "Pick a valid audience." },
      { status: 400 }
    );
  }
  if (!subject) {
    return NextResponse.json(
      { error: "Subject is required." },
      { status: 400 }
    );
  }
  if (!html) {
    return NextResponse.json(
      { error: "Message body is required." },
      { status: 400 }
    );
  }

  // Optional: send a single test email to a one-off address without writing
  // a blast row. Useful for previewing rendering.
  const testEmail = (body.test_email || "").trim();
  if (testEmail) {
    const company = await getCompanyForFooter(companyId);
    const origin = buildOrigin(req);
    const unsubToken = buildUnsubscribeToken(testEmail, companyId);
    const unsubscribeUrl = `${origin}/api/email/unsubscribe?token=${encodeURIComponent(
      unsubToken
    )}`;
    const fullHtml = applyEmailFooter({
      bodyHtml: html,
      unsubscribeUrl,
      company,
    });
    const result = await sendEmailViaResend({
      sender,
      to: testEmail,
      subject,
      html: fullHtml,
      text: body.body_text?.trim() || buildPlainTextFallback(fullHtml),
      unsubscribeUrl,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, test: true, id: result.id });
  }

  const recipients = await fetchAudience(audience, companyId);
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No recipients in that audience." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const insert = await db
    .prepare(
      `INSERT INTO email_blasts
         (company_id, audience, subject, body_html, body_text, from_address, from_name,
          status, recipient_count, sent_count, failed_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'sending', ?, 0, 0, ?, datetime('now'))`
    )
    .run(
      companyId,
      audience,
      subject,
      html,
      body.body_text?.trim() || null,
      sender.fromAddress,
      sender.fromName,
      recipients.length,
      ctx.identity
    );
  const blastId = Number(insert.lastInsertRowid);

  // Pre-create recipient rows so the count + status detail show up immediately.
  for (const r of recipients) {
    await db
      .prepare(
        `INSERT INTO email_recipients
           (blast_id, customer_id, email, name, status)
         VALUES (?, ?, ?, ?, 'queued')`
      )
      .run(blastId, r.customer_id, r.email, r.name);
  }

  const company = await getCompanyForFooter(companyId);
  const origin = buildOrigin(req);

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const unsubToken = buildUnsubscribeToken(r.email, companyId);
    const unsubscribeUrl = `${origin}/api/email/unsubscribe?token=${encodeURIComponent(
      unsubToken
    )}`;
    const fullHtml = applyEmailFooter({
      bodyHtml: html,
      unsubscribeUrl,
      company,
    });
    const text =
      body.body_text?.trim() || buildPlainTextFallback(fullHtml);

    const result = await sendEmailViaResend({
      sender,
      to: r.email,
      subject,
      html: fullHtml,
      text,
      unsubscribeUrl,
    });

    if (result.ok) {
      sent++;
      await db
        .prepare(
          `UPDATE email_recipients
             SET status = 'sent', provider_id = ?, sent_at = datetime('now')
           WHERE blast_id = ? AND email = ?`
        )
        .run(result.id, blastId, r.email);
    } else {
      failed++;
      await db
        .prepare(
          `UPDATE email_recipients
             SET status = 'failed', error = ?
           WHERE blast_id = ? AND email = ?`
        )
        .run(result.error, blastId, r.email);
    }
  }

  await db
    .prepare(
      `UPDATE email_blasts
         SET status = ?, sent_count = ?, failed_count = ?, sent_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      failed === 0 ? "sent" : sent === 0 ? "failed" : "partial",
      sent,
      failed,
      blastId
    );

  const blast = (await db
    .prepare("SELECT * FROM email_blasts WHERE id = ? AND company_id = ?")
    .get(blastId, companyId)) as EmailBlast;
  return NextResponse.json(blast, { status: 201 });
}
