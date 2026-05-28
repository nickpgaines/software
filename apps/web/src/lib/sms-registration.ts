// 10DLC registration state machine. Drives the async Twilio Trust Hub chain
// for a single tenant by reading their company row, figuring out the next
// step from a2p_registration_state, calling the Trust Hub API, and writing
// the resulting SID + new state back. Idempotent: re-running advance() on a
// company that's already in 'campaign_approved' is a no-op; re-running it
// while waiting on a pending review is a no-op until Twilio's status flips.
//
// advance() is called from:
//   - POST /api/sms/registration (right after the form submit)
//   - Twilio status webhook handlers (when a resource flips to approved)
//   - GET  /api/sms/registration  (so the panel can self-heal stalled chains)
//
// All side effects are wrapped in try/catch and persisted as failure states
// on the company row so the UI can render an actionable error. The orchestrator
// never throws back to its callers — it always returns the new state.

import {
  getDb,
  type A2pRegistrationState,
  type Company,
  type SmsBrandRegistration,
} from "@/lib/db";
import {
  ensureTenantSubaccount,
  getPlatformConfig,
} from "@/lib/twilio-platform";
import type { TwilioCreds } from "@/lib/twilio-trust-hub";
import {
  attachA2pProfileInfoEndUser,
  attachNumberToMessagingService,
  attachToCustomerProfile,
  attachToTrustProduct,
  createA2pTrustProduct,
  createAddress,
  createAddressSupportingDocument,
  createAuthorizedRepEndUser,
  createBrandRegistration,
  createBusinessInformationEndUser,
  createCampaign,
  createMessagingService,
  createPrimaryCustomerProfileLinkEndUser,
  createSecondaryCustomerProfile,
  fetchBrandRegistration,
  fetchCampaign,
  fetchCustomerProfile,
  fetchCustomerProfileEvaluations,
  fetchTrustProduct,
  summarizeEvaluationFailures,
  findAvailableLocalNumber,
  purchasePhoneNumber,
  submitCustomerProfile,
  submitTrustProduct,
} from "@/lib/twilio-trust-hub";

// Sole-proprietor brands must register their campaign under the SOLE_PROPRIETOR
// use case; everyone else registers as LOW_VOLUME — no external vetting, lowest
// carrier fees, and ample for transactional traffic plus modest consented
// blasts. A tenant that outgrows it is upgraded by vetting the brand (which
// raises the carrier daily caps), not by editing this — a campaign's use case
// is immutable once created.
function campaignUseCase(brandType: "STANDARD" | "SOLE_PROPRIETOR"): string {
  return brandType === "SOLE_PROPRIETOR" ? "SOLE_PROPRIETOR" : "LOW_VOLUME";
}

const CAMPAIGN_OPT_IN_KEYWORDS = ["START", "YES"];
const CAMPAIGN_OPT_OUT_KEYWORDS = [
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
];
const CAMPAIGN_HELP_KEYWORDS = ["HELP", "INFO"];

const CAMPAIGN_OPT_IN_MESSAGE =
  "You're re-subscribed. Reply STOP to unsubscribe again, HELP for help.";
const CAMPAIGN_HELP_MESSAGE =
  "For help, contact the business that sent you this message. Reply STOP to unsubscribe.";

const CAMPAIGN_MESSAGE_FLOW =
  "End users opt in by checking a dedicated SMS consent checkbox when they review and sign a service business's estimate — shown in person on the rep's tablet at the point of sale, or opened from a secure estimate link sent to the customer. " +
  "The checkbox is separate from approving the estimate and is not required to purchase service. The disclosure names the specific business and states the message types, that frequency varies, that message and data rates may apply, and that the recipient can reply STOP to opt out or HELP for help. " +
  "Each opt-in is recorded with a timestamp, the signer's name and mobile number, the originating business, the IP address, and the exact disclosure text agreed to. " +
  "Recipients can reply STOP to unsubscribe at any time or HELP for assistance, and we never share numbers with third parties.";

export type AdvanceResult = {
  state: A2pRegistrationState;
  error: string | null;
  done: boolean;
};

function buildWebhookUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}${path}`;
}

function entityTypeToA2p(formEntityType: string): {
  brandType: "STANDARD" | "SOLE_PROPRIETOR";
  companyType: string;
  businessType: string;
} {
  const v = formEntityType.toLowerCase();
  if (v.includes("sole")) {
    return {
      brandType: "SOLE_PROPRIETOR",
      companyType: "private",
      businessType: "Sole Proprietorship",
    };
  }
  if (v.includes("public")) {
    return {
      brandType: "STANDARD",
      companyType: "public",
      businessType: "Corporation",
    };
  }
  if (v.includes("non-profit") || v.includes("nonprofit")) {
    return {
      brandType: "STANDARD",
      companyType: "non-profit",
      businessType: "Non-Profit Corporation",
    };
  }
  if (v.includes("partnership")) {
    return {
      brandType: "STANDARD",
      companyType: "private",
      businessType: "Partnership",
    };
  }
  // Default LLC (form removed entity_type and defaults to LLC server-side).
  return {
    brandType: "STANDARD",
    companyType: "private",
    businessType: "Limited Liability Corporation",
  };
}

// Twilio Trust Hub business_industry enum. Home-service tenants land on
// PROFESSIONAL_SERVICES (cleaners, pest control, lawn, HVAC, etc.).
const TWILIO_BUSINESS_INDUSTRY = "PROFESSIONAL_SERVICES";

// Twilio Trust Hub job_position enum (Job Level). Default for owner-operated
// home-service businesses where the signer is the owner.
const TWILIO_JOB_POSITION = "Director";

function volumeLabel(v: string): string {
  if (v === "1k_6k") return "1,000-6,000";
  if (v === "6k_plus") return "6,000+";
  return "under 1,000";
}

// Twilio Trust Hub rejects non-E.164 phone numbers on the authorized rep
// end-user. The user-facing form accepts loose input ("8435045474",
// "(843) 504-5474"), so normalize before handing off.
function toE164US(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  return raw;
}

function buildCampaignDescription(name: string): string {
  return (
    `${name} sends SMS notifications to its customers including appointment ` +
    `reminders, payment receipts, post-service follow-ups, two-way customer ` +
    `service replies, and occasional promotional offers. Recipients have ` +
    `provided express consent at the point of sale (in-person or by phone) ` +
    `when initiating a service relationship with the business. Estimated ` +
    `monthly volume: ${volumeLabel("under_1k")}.`
  );
}

function buildMessageSamples(name: string): string[] {
  return [
    `Hi {first_name}, reminder that your appointment with ${name} is tomorrow at {time}. Reply STOP to opt out.`,
    `Thanks {first_name} — ${name} received your payment of \${amount}. Receipt: {receipt_url} Reply STOP to opt out.`,
    `Hi {first_name}, ${name} checking in after your service. Let us know if you need anything else. Reply STOP to opt out.`,
  ];
}

async function loadContext(companyId: number): Promise<{
  company: Company;
  registration: SmsBrandRegistration | null;
}> {
  const db = await getDb();
  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(companyId);
  if (!company) throw new Error(`Company ${companyId} not found`);
  const registration = await db
    .prepare(
      "SELECT * FROM sms_brand_registrations WHERE company_id = ? LIMIT 1"
    )
    .get<SmsBrandRegistration>(companyId);
  return { company, registration: registration ?? null };
}

async function persistState(
  companyId: number,
  state: A2pRegistrationState,
  error: string | null,
  patch: Partial<Company> = {}
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [
    "a2p_registration_state = ?",
    "a2p_registration_error = ?",
  ];
  const args: (string | number | null)[] = [state, error];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    args.push(v as string | number | null);
  }
  if (state === "campaign_approved") {
    fields.push("a2p_registration_approved_at = datetime('now')");
  }
  if (state === "customer_profile_pending") {
    fields.push(
      "a2p_registration_started_at = COALESCE(a2p_registration_started_at, datetime('now'))"
    );
  }
  args.push(companyId);
  await db
    .prepare(
      `UPDATE company SET ${fields.join(", ")}, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(...args);
}

function isPending(status: string): boolean {
  return (
    status === "pending-review" ||
    status === "in-review" ||
    status === "pending"
  );
}

function isApproved(status: string): boolean {
  return (
    status === "twilio-approved" ||
    status === "approved" ||
    status === "compliant"
  );
}

function isFailed(status: string): boolean {
  return (
    status === "twilio-rejected" ||
    status === "rejected" ||
    status === "failed" ||
    status === "noncompliant"
  );
}

// One step. Returns whether the caller should immediately recurse to try the
// next step in the same request (true for steps that complete synchronously
// like creating resources; false for steps that wait on Twilio review).
async function step(companyId: number): Promise<{
  state: A2pRegistrationState;
  error: string | null;
  recurse: boolean;
}> {
  const cfg = getPlatformConfig();
  if (!cfg) {
    return {
      state: "not_started",
      error: "Platform Twilio is not configured",
      recurse: false,
    };
  }

  const { company, registration } = await loadContext(companyId);
  if (!registration) {
    return {
      state: company.a2p_registration_state,
      error: "Registration form has not been submitted",
      recurse: false,
    };
  }
  if (!registration.submitted_at) {
    return {
      state: company.a2p_registration_state,
      error: "Registration form is not submitted yet",
      recurse: false,
    };
  }

  const state = company.a2p_registration_state;
  const { brandType, companyType, businessType } = entityTypeToA2p(
    registration.entity_type
  );
  const cpCallback = buildWebhookUrl(
    "/api/twilio/webhooks/customer-profile-status"
  );

  // 0. Ensure the tenant's Twilio subaccount exists. Every per-tenant
  // Trust Hub / Messaging API call below runs as that subaccount; the
  // trial pool stays on the master account and is handled elsewhere.
  let creds: TwilioCreds;
  try {
    creds = await ensureTenantSubaccount({
      companyId,
      friendlyName: registration.legal_company_name,
    });
  } catch (e) {
    const msg = (e as Error).message;
    await persistState(
      companyId,
      state === "not_started" ? "customer_profile_failed" : state,
      msg
    );
    return {
      state: state === "not_started" ? "customer_profile_failed" : state,
      error: msg,
      recurse: false,
    };
  }

  // 1. Create Secondary Customer Profile (+ EndUsers + Address + submit)
  if (state === "not_started" || state === "customer_profile_failed") {
    const primaryCpSid =
      process.env.TWILIO_PRIMARY_CUSTOMER_PROFILE_SID?.trim();
    if (!primaryCpSid) {
      const msg =
        "TWILIO_PRIMARY_CUSTOMER_PROFILE_SID is not configured — set it to the ISV master account's approved Primary Customer Profile SID (BU…) in the environment.";
      await persistState(companyId, "customer_profile_failed", msg);
      return { state: "customer_profile_failed", error: msg, recurse: false };
    }
    try {
      // On a failed retry, start a brand-new Customer Profile. Reusing the
      // failed one re-attaches a second business-info / rep / address to the
      // same bundle, and Twilio rejects the duplicate customer_profile_address.
      let cpSid =
        state === "customer_profile_failed"
          ? null
          : company.twilio_customer_profile_sid;
      if (!cpSid) {
        const cp = await createSecondaryCustomerProfile({
        creds,
          friendlyName: `nick360 tenant ${companyId} customer profile`,
          email: registration.business_email,
          statusCallback: cpCallback,
        });
        cpSid = cp.sid;
        await persistState(companyId, "customer_profile_pending", null, {
          twilio_customer_profile_sid: cpSid,
        });
      }

      // Twilio requires every Secondary CP to point back at the ISV's approved
      // Primary CP. Without this link, the bundle eval fails with
      // "primary_customer_profile_type_business: Primary customer profile bundle is null".
      const primaryLink = await createPrimaryCustomerProfileLinkEndUser({
        creds,
        friendlyName: `tenant-${companyId}-primary-link`,
        primaryCustomerProfileSid: primaryCpSid,
      });
      await attachToCustomerProfile({
        creds,
        customerProfileSid: cpSid,
        objectSid: primaryLink.sid,
      });

      const bi = await createBusinessInformationEndUser({
        creds,
        friendlyName: `tenant-${companyId}-business-info`,
        legalCompanyName: registration.legal_company_name,
        ein: registration.ein.replace(/\D/g, ""),
        entityType: businessType,
        industry: TWILIO_BUSINESS_INDUSTRY,
        website: registration.business_website,
        description: registration.business_description,
      });
      await attachToCustomerProfile({
        creds,
        customerProfileSid: cpSid,
        objectSid: bi.sid,
      });

      const [firstName, ...lastParts] = registration.auth_rep_name.split(/\s+/);
      const lastName = lastParts.join(" ") || firstName;
      const rep = await createAuthorizedRepEndUser({
        creds,
        friendlyName: `tenant-${companyId}-auth-rep`,
        firstName,
        lastName,
        email: registration.auth_rep_email,
        phone: toE164US(registration.business_phone),
        title: TWILIO_JOB_POSITION,
        businessTitle: registration.auth_rep_title,
      });
      await attachToCustomerProfile({
        creds,
        customerProfileSid: cpSid,
        objectSid: rep.sid,
      });

      const addr = await createAddress({
        creds,
        customerName: registration.legal_company_name,
        street: registration.address_line1,
        street2: registration.address_line2,
        city: registration.city,
        region: registration.region,
        postalCode: registration.postal_code,
        isoCountry: registration.iso_country,
      });
      // A bare Address can't be attached to the profile bundle (error 70002);
      // wrap it in a customer_profile_address supporting document first.
      const addrDoc = await createAddressSupportingDocument({
        creds,
        friendlyName: `tenant-${companyId}-address`,
        addressSid: addr.sid,
      });
      await attachToCustomerProfile({
        creds,
        customerProfileSid: cpSid,
        objectSid: addrDoc.sid,
      });

      await submitCustomerProfile({ creds, sid: cpSid });
      return { state: "customer_profile_pending", error: null, recurse: false };
    } catch (e) {
      const msg = (e as Error).message;
      await persistState(companyId, "customer_profile_failed", msg);
      return { state: "customer_profile_failed", error: msg, recurse: false };
    }
  }

  // 2. Wait for Customer Profile approval (Twilio webhook or refresh).
  if (state === "customer_profile_pending") {
    if (!company.twilio_customer_profile_sid) {
      await persistState(companyId, "not_started", "Missing customer profile SID");
      return { state: "not_started", error: null, recurse: true };
    }
    try {
      const cp = await fetchCustomerProfile({ creds, sid: company.twilio_customer_profile_sid });
      if (isApproved(cp.status)) {
        await persistState(companyId, "customer_profile_approved", null);
        return { state: "customer_profile_approved", error: null, recurse: true };
      }
      if (isFailed(cp.status)) {
        const evals = await fetchCustomerProfileEvaluations({
          creds,
          sid: company.twilio_customer_profile_sid,
        }).catch(() => []);
        const reason = summarizeEvaluationFailures(evals);
        const msg = reason
          ? `Customer Profile rejected by Twilio: ${reason}`
          : `Customer Profile rejected by Twilio (status=${cp.status})`;
        await persistState(companyId, "customer_profile_failed", msg);
        return {
          state: "customer_profile_failed",
          error: msg,
          recurse: false,
        };
      }
      return {
        state: "customer_profile_pending",
        error: null,
        recurse: false,
      };
    } catch (e) {
      return {
        state: "customer_profile_pending",
        error: (e as Error).message,
        recurse: false,
      };
    }
  }

  // 3. Customer Profile approved → create A2P Trust Product, attach, submit.
  if (
    state === "customer_profile_approved" ||
    state === "trust_product_failed"
  ) {
    try {
      // Same idempotency fix as the Customer Profile: a failed retry starts a
      // fresh Trust Product instead of re-attaching to the old one.
      let tpSid =
        state === "trust_product_failed"
          ? null
          : company.twilio_trust_product_sid;
      if (!tpSid) {
        const tp = await createA2pTrustProduct({
        creds,
          friendlyName: `nick360 tenant ${companyId} A2P trust product`,
          email: registration.business_email,
          statusCallback: cpCallback,
        });
        tpSid = tp.sid;
        await persistState(companyId, "trust_product_pending", null, {
          twilio_trust_product_sid: tpSid,
        });
      }
      await attachToTrustProduct({
        creds,
        trustProductSid: tpSid,
        objectSid: company.twilio_customer_profile_sid!,
      });
      await attachA2pProfileInfoEndUser({
        creds,
        trustProductSid: tpSid,
        companyType,
        stockExchange: null,
        stockTicker: null,
      });
      await submitTrustProduct({ creds, sid: tpSid });
      return { state: "trust_product_pending", error: null, recurse: false };
    } catch (e) {
      const msg = (e as Error).message;
      await persistState(companyId, "trust_product_failed", msg);
      return { state: "trust_product_failed", error: msg, recurse: false };
    }
  }

  // 4. Wait for Trust Product approval.
  if (state === "trust_product_pending") {
    if (!company.twilio_trust_product_sid) {
      await persistState(companyId, "customer_profile_approved", null);
      return { state: "customer_profile_approved", error: null, recurse: true };
    }
    try {
      const tp = await fetchTrustProduct({ creds, sid: company.twilio_trust_product_sid });
      if (isApproved(tp.status)) {
        await persistState(companyId, "trust_product_approved", null);
        return { state: "trust_product_approved", error: null, recurse: true };
      }
      if (isFailed(tp.status)) {
        const msg = `Trust Product rejected (status=${tp.status})`;
        await persistState(companyId, "trust_product_failed", msg);
        return { state: "trust_product_failed", error: msg, recurse: false };
      }
      return { state: "trust_product_pending", error: null, recurse: false };
    } catch (e) {
      return {
        state: "trust_product_pending",
        error: (e as Error).message,
        recurse: false,
      };
    }
  }

  // 5. Trust Product approved → create Brand Registration.
  if (state === "trust_product_approved" || state === "brand_failed") {
    try {
      let brandSid = company.twilio_brand_sid;
      if (!brandSid) {
        const brand = await createBrandRegistration({
        creds,
          customerProfileSid: company.twilio_customer_profile_sid!,
          trustProductSid: company.twilio_trust_product_sid!,
          brandType,
          // Skip the ~$40 external secondary vetting. It only buys higher
          // carrier throughput/daily caps, which low-volume tenants never
          // reach. Vet on demand later for a tenant that needs the headroom.
          skipAutomaticSecondaryVetting: true,
        });
        brandSid = brand.sid;
        await persistState(companyId, "brand_pending", null, {
          twilio_brand_sid: brandSid,
        });
      } else {
        await persistState(companyId, "brand_pending", null);
      }
      return { state: "brand_pending", error: null, recurse: false };
    } catch (e) {
      const msg = (e as Error).message;
      await persistState(companyId, "brand_failed", msg);
      return { state: "brand_failed", error: msg, recurse: false };
    }
  }

  // 6. Wait for Brand approval.
  if (state === "brand_pending") {
    if (!company.twilio_brand_sid) {
      await persistState(companyId, "trust_product_approved", null);
      return { state: "trust_product_approved", error: null, recurse: true };
    }
    try {
      const brand = await fetchBrandRegistration({ creds, sid: company.twilio_brand_sid });
      if (isApproved(brand.status)) {
        await persistState(companyId, "brand_approved", null);
        return { state: "brand_approved", error: null, recurse: true };
      }
      if (isFailed(brand.status)) {
        const msg =
          brand.failure_reason ||
          `Brand registration rejected (status=${brand.status})`;
        await persistState(companyId, "brand_failed", msg);
        return { state: "brand_failed", error: msg, recurse: false };
      }
      return { state: "brand_pending", error: null, recurse: false };
    } catch (e) {
      return {
        state: "brand_pending",
        error: (e as Error).message,
        recurse: false,
      };
    }
  }

  // 7. Brand approved → create Messaging Service + Campaign.
  if (state === "brand_approved" || state === "campaign_failed") {
    try {
      let msSid = company.twilio_messaging_service_sid;
      if (!msSid) {
        const inboundUrl = buildWebhookUrl("/api/messages/webhook");
        const statusUrl = buildWebhookUrl(
          "/api/twilio/webhooks/campaign-status"
        );
        const ms = await createMessagingService({
        creds,
          friendlyName:
            `nick360 tenant ${companyId} (${registration.legal_company_name})`.slice(
              0,
              64
            ),
          inboundRequestUrl: inboundUrl,
          statusCallback: statusUrl,
        });
        msSid = ms.sid;
        await persistState(companyId, "brand_approved", null, {
          twilio_messaging_service_sid: msSid,
        });
      }

      let campaignSid = company.twilio_campaign_sid;
      if (!campaignSid) {
        const campaign = await createCampaign({
        creds,
          messagingServiceSid: msSid,
          brandRegistrationSid: company.twilio_brand_sid!,
          description: buildCampaignDescription(registration.legal_company_name),
          messageSamples: buildMessageSamples(registration.legal_company_name),
          messageFlow: CAMPAIGN_MESSAGE_FLOW,
          usAppToPersonUsecase: campaignUseCase(brandType),
          hasEmbeddedLinks: true,
          hasEmbeddedPhone: false,
          optInKeywords: CAMPAIGN_OPT_IN_KEYWORDS,
          optInMessage: CAMPAIGN_OPT_IN_MESSAGE,
          optOutKeywords: CAMPAIGN_OPT_OUT_KEYWORDS,
          optOutMessage:
            "You have been unsubscribed and will not receive any more messages. Reply START to re-subscribe.",
          helpKeywords: CAMPAIGN_HELP_KEYWORDS,
          helpMessage: CAMPAIGN_HELP_MESSAGE,
        });
        campaignSid = campaign.sid;
        await persistState(companyId, "campaign_pending", null, {
          twilio_campaign_sid: campaignSid,
        });
      }
      return { state: "campaign_pending", error: null, recurse: false };
    } catch (e) {
      const msg = (e as Error).message;
      await persistState(companyId, "campaign_failed", msg);
      return { state: "campaign_failed", error: msg, recurse: false };
    }
  }

  // 8. Wait for Campaign approval.
  if (state === "campaign_pending") {
    if (
      !company.twilio_campaign_sid ||
      !company.twilio_messaging_service_sid
    ) {
      await persistState(companyId, "brand_approved", null);
      return { state: "brand_approved", error: null, recurse: true };
    }
    try {
      const campaign = await fetchCampaign({
        creds,
        messagingServiceSid: company.twilio_messaging_service_sid,
        campaignSid: company.twilio_campaign_sid,
      });
      if (isApproved(campaign.status) || campaign.status === "VERIFIED") {
        await persistState(companyId, "campaign_approved", null);
        return { state: "campaign_approved", error: null, recurse: true };
      }
      if (isFailed(campaign.status) || campaign.status === "FAILED") {
        const msg =
          campaign.failure_reason ||
          `Campaign rejected (status=${campaign.status})`;
        await persistState(companyId, "campaign_failed", msg);
        return { state: "campaign_failed", error: msg, recurse: false };
      }
      return { state: "campaign_pending", error: null, recurse: false };
    } catch (e) {
      return {
        state: "campaign_pending",
        error: (e as Error).message,
        recurse: false,
      };
    }
  }

  // 9. Campaign approved → buy + attach dedicated number, flip to paid_approved.
  if (state === "campaign_approved" && !company.sms_dedicated_number) {
    try {
      const areaCode =
        (registration.business_phone.replace(/\D/g, "").match(/\d{10}$/)?.[0] ?? "")
          .slice(0, 3) || "843";
      const number = await findAvailableLocalNumber({ creds, areaCode });
      if (!number) {
        const msg = `No numbers available in area code ${areaCode}`;
        await persistState(companyId, "campaign_failed", msg);
        return { state: "campaign_failed", error: msg, recurse: false };
      }
      const inboundUrl = buildWebhookUrl("/api/messages/webhook");
      const voiceUrl = buildWebhookUrl("/api/voice/outbound");
      const purchased = await purchasePhoneNumber({
        creds,
        phoneNumber: number,
        friendlyName: `nick360:${companyId}:${registration.legal_company_name}`,
        smsUrl: inboundUrl,
        voiceUrl,
      });
      await attachNumberToMessagingService({
        creds,
        messagingServiceSid: company.twilio_messaging_service_sid!,
        phoneNumberSid: purchased.sid,
      });
      await persistState(companyId, "campaign_approved", null, {
        sms_dedicated_number: purchased.phone_number,
        sms_dedicated_number_sid: purchased.sid,
      });
      return { state: "campaign_approved", error: null, recurse: false };
    } catch (e) {
      const msg = (e as Error).message;
      await persistState(companyId, "campaign_failed", msg);
      return { state: "campaign_failed", error: msg, recurse: false };
    }
  }

  return { state, error: company.a2p_registration_error, recurse: false };
}

export async function advanceRegistration(
  companyId: number
): Promise<AdvanceResult> {
  // Cap the loop in case a step incorrectly returns recurse=true forever.
  let remaining = 12;
  let last: { state: A2pRegistrationState; error: string | null } = {
    state: "not_started",
    error: null,
  };
  while (remaining-- > 0) {
    const r = await step(companyId);
    last = { state: r.state, error: r.error };
    if (!r.recurse) break;
  }
  return {
    state: last.state,
    error: last.error,
    done: last.state === "campaign_approved",
  };
}

// Pure helpers exported for the UI / API to know whether to expose form
// editing and the "resubmit" affordance.

const PENDING_STATES: A2pRegistrationState[] = [
  "customer_profile_pending",
  "trust_product_pending",
  "brand_pending",
  "campaign_pending",
];

const FAILED_STATES: A2pRegistrationState[] = [
  "customer_profile_failed",
  "trust_product_failed",
  "brand_failed",
  "campaign_failed",
];

export function isPendingState(s: A2pRegistrationState): boolean {
  return PENDING_STATES.includes(s);
}

export function isFailedState(s: A2pRegistrationState): boolean {
  return FAILED_STATES.includes(s);
}
export { isPending, isApproved, isFailed };
