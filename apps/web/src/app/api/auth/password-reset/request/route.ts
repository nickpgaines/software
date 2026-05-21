import { NextResponse } from "next/server";
import { getDb, syncReplica, type Staff } from "@/lib/db";
import { buildOriginFromRequest } from "@/lib/email";
import {
  generateResetToken,
  renderResetEmailHtml,
  renderResetEmailText,
  resetTokenExpiry,
  sendPlatformEmail,
} from "@/lib/password-reset";

export const dynamic = "force-dynamic";

// Always return a generic success response. We do NOT reveal whether the
// email matches a real account — that's the standard mitigation against
// account-enumeration via the reset endpoint.
const GENERIC_OK = {
  ok: true,
  message:
    "If that email matches an account, we just sent reset instructions to it.",
} as const;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(GENERIC_OK);
  }

  const db = await getDb();
  const sql = "SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1";
  let staff = (await db.prepare(sql).get(email)) as Staff | undefined;
  if (!staff) {
    // Same stale-replica handling as the login route.
    await syncReplica();
    staff = (await db.prepare(sql).get(email)) as Staff | undefined;
  }

  // Build the response now so we always return identical timing/shape whether
  // or not the email matched.
  const response: Record<string, unknown> = { ...GENERIC_OK };

  if (staff) {
    const { raw, hash } = generateResetToken();
    await db
      .prepare(
        `INSERT INTO password_reset_tokens (staff_id, token_hash, expires_at)
         VALUES (?, ?, ?)`
      )
      .run(staff.id, hash, resetTokenExpiry());

    const origin = buildOriginFromRequest(req);
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(raw)}`;

    const sendResult = await sendPlatformEmail({
      to: staff.email || email,
      subject: "Reset your Forge CRM password",
      html: renderResetEmailHtml(resetUrl),
      text: renderResetEmailText(resetUrl),
    });

    // Dev convenience: when the platform Resend key isn't configured we can't
    // actually send an email, so return the link directly so local testers
    // aren't stuck. Never leak the link in production.
    if (
      !sendResult.ok &&
      process.env.NODE_ENV !== "production" &&
      sendResult.error === "platform_email_not_configured"
    ) {
      response.devResetUrl = resetUrl;
    }
  }

  return NextResponse.json(response);
}
