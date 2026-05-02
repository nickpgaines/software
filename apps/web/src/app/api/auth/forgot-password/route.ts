import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";
import { buildOriginFromRequest } from "@/lib/email";
import { buildResetToken, sendResetEmail } from "@/lib/password-reset";
import {
  checkPasswordResetRate,
  clientIp,
  recordPasswordResetAttempt,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Generic response we always return so attackers can't probe which emails
// belong to staff. Same body whether the email exists, is unknown, has no
// password set, or even when our email provider is misconfigured — the only
// thing that varies is what we do server-side.
const GENERIC_OK = {
  ok: true,
  message:
    "If that email matches an account, we've sent a link to reset the password.",
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown;
  };
  const rawEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const email = rawEmail || null;

  const ip = clientIp(req);
  const rate = await checkPasswordResetRate(ip, email);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many password reset requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  // Record the attempt unconditionally so the rate limiter accumulates
  // against both real and probing requests.
  await recordPasswordResetAttempt(ip, email);

  // No email supplied: still 200, generic body. Don't leak that we required it.
  if (!email) return NextResponse.json(GENERIC_OK);

  // Look up the staff row by email. If absent, OR the row has no password
  // hash (e.g. a stub created before any login was set up), we silently
  // skip sending and return the generic OK.
  const db = await getDb();
  const staff = (await db
    .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
    .get(email)) as Staff | undefined;

  if (!staff || !staff.password_hash || !staff.email) {
    return NextResponse.json(GENERIC_OK);
  }

  const token = buildResetToken({
    staffId: staff.id,
    passwordHash: staff.password_hash,
  });
  const origin = buildOriginFromRequest(req);
  const resetUrl = `${origin}/reset-password/${encodeURIComponent(token)}`;

  const recipientName =
    [staff.first_name, staff.last_name]
      .filter((s): s is string => !!s && s.trim() !== "")
      .join(" ") ||
    staff.name ||
    null;

  const result = await sendResetEmail({
    to: staff.email,
    recipientName,
    resetUrl,
  });

  if (!result.ok) {
    // Swallow send errors so the response stays uniform. Log so the admin
    // can spot misconfiguration in their hosting logs.
    console.error("Password reset email failed to send", {
      reason: result.reason,
      detail: result.reason === "send_failed" ? result.detail : undefined,
      staffId: staff.id,
    });
  }

  return NextResponse.json(GENERIC_OK);
}
