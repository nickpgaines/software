import { getDb } from "@/lib/db";
import { advanceRegistration } from "@/lib/sms-registration";
import { verifyTwilioWebhook } from "@/lib/twilio-webhook-signature";

type Resource = "customer-profile" | "brand" | "campaign";
const resources = {
  "customer-profile": {
    keys: ["sid", "Sid", "BundleSid", "BundleSID", "CustomerProfileSid", "TrustProductSid", "customer_profile_sid", "trust_product_sid"],
    columns: ["twilio_customer_profile_sid", "twilio_trust_product_sid"],
  },
  brand: { keys: ["sid", "Sid", "BrandSid", "brand_sid"], columns: ["twilio_brand_sid"] },
  campaign: { keys: ["sid", "Sid", "CampaignSid", "campaign_sid"], columns: ["twilio_campaign_sid"] },
} as const;

function response(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store" } });
}

// Authenticate the resource's owning subaccount, then fetch current provider
// state via the leased state machine. The payload never determines approval.
export async function handleRegistrationWebhook(req: Request, resource: Resource) {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return response("Invalid signature", 403);
  if (req.method === "POST" && !req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return response("Expected form-encoded callback", 415);
  }
  const fields = req.method === "GET"
    ? new URL(req.url).searchParams
    : new URLSearchParams(await req.text());
  // Reject ambiguous fields rather than validate a different payload from
  // the one used to select the tenant.
  for (const key of fields.keys()) {
    const values = fields.getAll(key);
    // TwilioProxy repeats the same body hash on redirected Trust Hub GETs.
    // It is not a tenant selector; keep the original URL intact for signature
    // verification and continue rejecting ambiguous resource/account fields.
    const repeatedHash = req.method === "GET" && key === "bodySHA256" &&
      /^[a-f0-9]{64}$/.test(values[0]) && values.every(value => value === values[0]);
    if (values.length !== 1 && !repeatedHash) return response("Ambiguous callback parameters", 400);
  }
  const definition = resources[resource];
  const sids = new Set(definition.keys.map(key => fields.get(key)).filter(Boolean));
  if (sids.size !== 1) return response("Missing or ambiguous resource SID", 400);
  const sid = [...sids][0]!;
  const db = await getDb();
  const company = await db.prepare(`SELECT id, twilio_subaccount_sid, twilio_subaccount_auth_token
    FROM company WHERE ${definition.columns.map(column => `${column} = ?`).join(" OR ")} LIMIT 1`
  ).get<{ id: number; twilio_subaccount_sid: string | null; twilio_subaccount_auth_token: string | null }>(
    ...definition.columns.map(() => sid)
  );
  if (!company) return response("Unknown resource", 404);
  const accounts = [fields.get("AccountSid"), fields.get("account_sid")].filter(Boolean);
  if (accounts.some(account => account !== company.twilio_subaccount_sid)) return response("Invalid signature", 403);
  const token = company.twilio_subaccount_auth_token;
  const params = req.method === "GET" ? {} : Object.fromEntries(fields);
  if (!verifyTwilioWebhook(req, params, token)) {
    return response("Invalid signature", 403);
  }
  try {
    const progress = await advanceRegistration(company.id);
    // Persisted rejections are handled. Transient status-fetch or provisioning
    // failures must not be acknowledged as successful delivery.
    if (progress.error && !progress.state.endsWith("_failed")) {
      console.warn(`[sms/registration-webhook] Retry needed for company ${company.id}, state ${progress.state}`);
      return response("Registration refresh unavailable", 503);
    }
    return response("ok", 200);
  } catch {
    console.error(`[sms/registration-webhook] Refresh failed for company ${company.id}`);
    return response("Registration refresh unavailable", 503);
  }
}
