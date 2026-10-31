import twilio from "twilio";

export function verifyTwilioWebhook(
  req: Request,
  params: Record<string, string>,
  authToken: string | null | undefined,
): boolean {
  const signature = req.headers.get("x-twilio-signature");
  if (!authToken || !signature) return false;
  const url = new URL(req.url);
  const urls = new Set([req.url]);
  // Callbacks created before the www redirect still use the apex URL.
  // Preserve raw query encoding: GET parameters belong in the signed URL,
  // not the form-parameter argument. Never trust forwarded host headers.
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) urls.add(`${base.replace(/\/$/, "")}${url.pathname}${url.search}`);
  if (["https://forgecrm.app", "https://www.forgecrm.app"].includes(url.origin)) {
    urls.add(`https://forgecrm.app${url.pathname}${url.search}`);
    urls.add(`https://www.forgecrm.app${url.pathname}${url.search}`);
  }
  return [...urls].some(candidate => twilio.validateRequest(authToken, signature, candidate, params));
}
