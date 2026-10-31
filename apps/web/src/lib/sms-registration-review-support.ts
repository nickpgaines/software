import { getDb, type Company } from "@/lib/db";
import {
  fetchCustomerProfile, fetchTrustProduct, fetchBrandRegistration, fetchCampaign,
  normalizeTwilioStatus,
} from "@/lib/twilio-trust-hub";
import type { SmsReviewSupport } from "@/lib/sms-review-support";

// Prompting thresholds, not guaranteed review SLAs. date_updated is a
// conservative lower bound on waiting, NOT the original application date.
const STAGES = {
  customer_profile_pending: { label: "Customer profile", days: 7, field: "twilio_customer_profile_sid" },
  trust_product_pending: { label: "Trust product", days: 7, field: "twilio_trust_product_sid" },
  brand_pending: { label: "Brand registration", days: 2, field: "twilio_brand_sid" },
  campaign_pending: { label: "Campaign", days: 10, field: "twilio_campaign_sid" },
} as const;

type ReviewCompany = Pick<Company, "name" | "a2p_registration_state" |
  "twilio_subaccount_sid" | "twilio_subaccount_auth_token" |
  "twilio_customer_profile_sid" | "twilio_trust_product_sid" |
  "twilio_brand_sid" | "twilio_campaign_sid" | "twilio_messaging_service_sid">;

// Optional read-only enrichment. No subaccount creation, submissions, or retry
// of failed applications. Errors intentionally suppress the attribution notice.
export async function getRegistrationReviewSupport(
  companyId: number, expectedState: string, now = Date.now(),
): Promise<SmsReviewSupport | null> {
  if (!Object.hasOwn(STAGES, expectedState) || !Number.isFinite(now)) return null;
  const state = expectedState as keyof typeof STAGES;
  const stage = STAGES[state];
  try {
    const db = await getDb();
    const readCompany = () => db.prepare(`
      SELECT name, a2p_registration_state, twilio_subaccount_sid,
             twilio_subaccount_auth_token, twilio_customer_profile_sid,
             twilio_trust_product_sid, twilio_brand_sid, twilio_campaign_sid,
             twilio_messaging_service_sid
      FROM company WHERE id = ? LIMIT 1
    `).get<ReviewCompany>(companyId);
    const company = await readCompany();
    if (!company || company.a2p_registration_state !== state ||
        !company.twilio_subaccount_sid || !company.twilio_subaccount_auth_token) return null;
    const sid = company[stage.field];
    if (!sid || (state === "campaign_pending" && !company.twilio_messaging_service_sid)) return null;
    const creds = { accountSid: company.twilio_subaccount_sid, authToken: company.twilio_subaccount_auth_token };
    const resource = state === "customer_profile_pending"
      ? await fetchCustomerProfile({ creds, sid })
      : state === "trust_product_pending"
        ? await fetchTrustProduct({ creds, sid })
        : state === "brand_pending"
          ? await fetchBrandRegistration({ creds, sid })
          : await fetchCampaign({ creds, campaignSid: sid, messagingServiceSid: company.twilio_messaging_service_sid! });
    if (resource.sid !== sid || (resource.account_sid && resource.account_sid !== creds.accountSid)) return null;
    const rawStatus = "campaign_status" in resource ? resource.campaign_status : resource.status;
    if (typeof rawStatus !== "string") return null;
    const providerStatus = normalizeTwilioStatus(rawStatus);
    if (!["PENDING", "PENDING_REVIEW", "IN_REVIEW", "IN_PROGRESS"].includes(providerStatus)) return null;
    const updated = typeof resource.date_updated === "string" ? Date.parse(resource.date_updated) : NaN;
    if (!Number.isFinite(updated) || now - updated < stage.days * 86_400_000) return null;
    // A callback or another refresh may have moved the application while this
    // request was in flight. Never publish guidance for a superseded resource.
    const latest = await readCompany();
    if (!latest || latest.a2p_registration_state !== state || latest[stage.field] !== sid ||
        latest.twilio_subaccount_sid !== creds.accountSid ||
        latest.twilio_messaging_service_sid !== company.twilio_messaging_service_sid) return null;
    return {
      state, stage: stage.label, providerStatus,
      lastUpdatedAt: new Date(updated).toISOString(), checkedAt: new Date(now).toISOString(),
      companyName: company.name?.trim() || "Business", accountSid: creds.accountSid, resourceSid: sid,
      messagingServiceSid: state === "campaign_pending" ? company.twilio_messaging_service_sid : null,
    };
  } catch {
    return null;
  }
}
