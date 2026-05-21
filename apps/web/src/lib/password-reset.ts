import crypto from "node:crypto";

// Reset tokens expire after one hour. Short enough to limit the blast radius
// of a leaked link from an inbox or shared screenshot, long enough that a
// tester typing in their email and stepping away for coffee still works.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function resetTokenExpiry(): string {
  return new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
}

type PlatformEmailSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

// Send a transactional email using the platform-level Resend key. Password
// reset emails can't ride on tenant email_settings because a freshly-signed-up
// tester (the exact person who needs reset) usually hasn't configured email
// yet. Returns the dev preview link path when the platform key is absent so
// local development still works without external services.
export async function sendPlatformEmail(
  input: PlatformEmailSendInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, error: "platform_email_not_configured" };
  }
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "network_error" };
  }
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.name || `resend_${res.status}`,
    };
  }
  return { ok: true, id: data.id || "" };
}

export function renderResetEmailHtml(resetUrl: string): string {
  const escaped = resetUrl
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;padding:32px;color:#0f172a;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 12px;font-size:20px;">Reset your password</h1>
    <p style="margin:0 0 16px;color:#475569;">Someone (hopefully you) asked to reset the password on your Forge CRM account. Click the button below to choose a new one. The link is good for one hour.</p>
    <p style="margin:24px 0;"><a href="${escaped}" style="background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;display:inline-block;">Reset password</a></p>
    <p style="margin:0 0 8px;color:#475569;font-size:13px;">Or copy this link into your browser:</p>
    <p style="margin:0 0 16px;word-break:break-all;font-size:12px;color:#475569;"><a href="${escaped}" style="color:#475569;">${escaped}</a></p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">If you didn't ask to reset your password, you can ignore this email — your password won't change.</p>
  </div>
</body></html>`;
}

export function renderResetEmailText(resetUrl: string): string {
  return [
    "Reset your password",
    "",
    "Someone (hopefully you) asked to reset the password on your Forge CRM account.",
    "Open this link to choose a new one. It's good for one hour.",
    "",
    resetUrl,
    "",
    "If you didn't ask to reset your password, you can ignore this email.",
  ].join("\n");
}
