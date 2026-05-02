import crypto from "node:crypto";
import {
  buildPlainTextFallback,
  getCompanyForFooter,
  getEmailSettings,
  isEmailConfigured,
  sendEmailViaResend,
} from "@/lib/email";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const HASH_PREFIX_LEN = 16;

function tokenSecret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production for password-reset token signing."
    );
  }
  return "dev-secret-change-me";
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

function sign(payload: string): Buffer {
  return crypto.createHmac("sha256", tokenSecret()).update(payload).digest();
}

// Token shape: base64url(payload) "." base64url(hmac)
//   payload = "${staffId}:${hashPrefix}:${issuedAtMs}"
// hashPrefix is the first 16 chars of the user's current password_hash.
// Once they change their password, the prefix changes, so this token can
// never be reused — no DB tracking required for single-use semantics.
export function buildResetToken(args: {
  staffId: number;
  passwordHash: string;
  now?: number;
}): string {
  const issuedAt = args.now ?? Date.now();
  const prefix = args.passwordHash.slice(0, HASH_PREFIX_LEN);
  const payload = `${args.staffId}:${prefix}:${issuedAt}`;
  const sig = sign(payload);
  return `${base64url(payload)}.${base64url(sig)}`;
}

export type VerifyResult =
  | { ok: true; staffId: number; hashPrefix: string; issuedAt: number }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyResetToken(
  token: string,
  now: number = Date.now()
): VerifyResult {
  const dot = token.indexOf(".");
  if (dot < 1) return { ok: false, reason: "malformed" };
  let payload: string;
  let sig: Buffer;
  try {
    payload = fromBase64url(token.slice(0, dot)).toString("utf8");
    sig = fromBase64url(token.slice(dot + 1));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(sig, expected)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  const parts = payload.split(":");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const staffId = Number(parts[0]);
  const hashPrefix = parts[1];
  const issuedAt = Number(parts[2]);
  if (
    !Number.isFinite(staffId) ||
    !Number.isFinite(issuedAt) ||
    !hashPrefix
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (now - issuedAt > TOKEN_TTL_MS) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, staffId, hashPrefix, issuedAt };
}

// Confirms the token's hash prefix matches the staff member's CURRENT password
// hash. If they've already reset their password since the link was minted, the
// prefix won't match and the token is rejected — this is what gives us
// single-use semantics without a DB-tracked tokens table.
export function tokenMatchesCurrentHash(
  hashPrefix: string,
  currentPasswordHash: string
): boolean {
  const expected = currentPasswordHash.slice(0, HASH_PREFIX_LEN);
  if (expected.length !== hashPrefix.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(hashPrefix)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildResetEmailHtml(args: {
  recipientName: string | null;
  companyName: string | null;
  resetUrl: string;
}): string {
  const { recipientName, companyName, resetUrl } = args;
  const greeting = recipientName
    ? `Hi ${escapeHtml(recipientName)},`
    : "Hi,";
  const signoff = companyName
    ? `— The ${escapeHtml(companyName)} team`
    : "— The team";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.5;max-width:560px;">
      <p>${greeting}</p>
      <p>We received a request to reset the password on your account. Click the link below to choose a new one:</p>
      <p style="margin:20px 0;">
        <a href="${escapeHtml(resetUrl)}"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:500;">
          Reset your password
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">
        Or paste this link into your browser:<br>
        <span style="word-break:break-all;">${escapeHtml(resetUrl)}</span>
      </p>
      <p style="color:#6b7280;font-size:13px;">
        This link expires in 30 minutes and can only be used once. If you didn't request a password reset, you can safely ignore this email — your password won't change.
      </p>
      <p style="margin-top:24px;color:#6b7280;font-size:13px;">${signoff}</p>
    </div>
  `;
}

export type SendResetEmailInput = {
  to: string;
  recipientName: string | null;
  resetUrl: string;
};

export type SendResetEmailResult =
  | { ok: true }
  | { ok: false; reason: "email_not_configured" | "send_failed"; detail?: string };

export async function sendResetEmail(
  input: SendResetEmailInput
): Promise<SendResetEmailResult> {
  const settings = await getEmailSettings();
  if (!isEmailConfigured(settings)) {
    return { ok: false, reason: "email_not_configured" };
  }
  const company = await getCompanyForFooter();
  const html = buildResetEmailHtml({
    recipientName: input.recipientName,
    companyName: company.name,
    resetUrl: input.resetUrl,
  });
  const subject = company.name
    ? `Reset your ${company.name} password`
    : "Reset your password";

  const result = await sendEmailViaResend({
    settings,
    to: input.to,
    subject,
    html,
    text: buildPlainTextFallback(html),
    // Intentionally no unsubscribeUrl: this is a transactional security
    // email, not marketing. List-Unsubscribe headers would be inappropriate.
  });

  if (!result.ok) {
    return { ok: false, reason: "send_failed", detail: result.error };
  }
  return { ok: true };
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export function validateNewPassword(
  password: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== "string") {
    return { ok: false, error: "Password is required." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: password };
}
