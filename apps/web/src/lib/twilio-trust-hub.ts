// Twilio Trust Hub + Messaging API client. Every call here hits the master
// account credentials — every tenant's A2P 10DLC resources are owned by the
// platform account, not subaccounts. The orchestrator in lib/sms-registration
// drives the state machine; this file is the dumb HTTP layer.
//
// All resource creation is idempotent at the orchestrator level: we persist
// each returned SID onto the company row before moving to the next step, and
// re-running the orchestrator skips any step whose SID is already stored.

import { getPlatformConfig } from "@/lib/twilio-platform";

const TRUST_HUB_BASE = "https://trusthub.twilio.com";
const MESSAGING_BASE = "https://messaging.twilio.com";
const API_BASE = "https://api.twilio.com";
const NUMBERS_BASE = "https://numbers.twilio.com";

const POLICY_SECONDARY_CUSTOMER_PROFILE = "RNdfbf3fae0e1107f8aded0e7cead80bf5";
const POLICY_A2P_TRUST_PRODUCT = "RNb0d4771c2c98518d916a3d4cd70a8f8b";

function masterAuthHeader(): string {
  const cfg = getPlatformConfig();
  if (!cfg) throw new Error("Platform Twilio is not configured");
  return (
    "Basic " +
    Buffer.from(`${cfg.masterAccountSid}:${cfg.masterAuthToken}`).toString(
      "base64"
    )
  );
}

async function twilioRequest<T>(
  method: "GET" | "POST",
  url: string,
  form?: Record<string, string | string[] | undefined>
): Promise<T> {
  const body =
    form && method === "POST" ? buildForm(form).toString() : undefined;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: masterAuthHeader(),
      ...(body
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as
    | T
    | { code?: number; message?: string; more_info?: string };
  if (!res.ok) {
    const msg =
      (data as { message?: string }).message || `Twilio ${res.status}`;
    const code = (data as { code?: number }).code;
    const err = new Error(code ? `[${code}] ${msg}` : msg) as Error & {
      code?: number;
      status?: number;
    };
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function buildForm(
  form: Record<string, string | string[] | undefined>
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) {
    if (v == null) continue;
    if (Array.isArray(v)) for (const item of v) out.append(k, item);
    else out.set(k, v);
  }
  return out;
}

export type CustomerProfileResource = {
  sid: string;
  status: string;
  friendly_name: string;
  policy_sid: string;
};

export async function createSecondaryCustomerProfile(args: {
  friendlyName: string;
  email: string;
  statusCallback: string | null;
}): Promise<CustomerProfileResource> {
  return twilioRequest<CustomerProfileResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles`,
    {
      FriendlyName: args.friendlyName,
      Email: args.email,
      PolicySid: POLICY_SECONDARY_CUSTOMER_PROFILE,
      StatusCallback: args.statusCallback ?? undefined,
    }
  );
}

export async function fetchCustomerProfile(
  sid: string
): Promise<CustomerProfileResource> {
  return twilioRequest<CustomerProfileResource>(
    "GET",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(sid)}`
  );
}

export async function submitCustomerProfile(
  sid: string
): Promise<CustomerProfileResource> {
  return twilioRequest<CustomerProfileResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(sid)}`,
    { Status: "pending-review" }
  );
}

export type EndUserResource = { sid: string; type: string };

export async function createBusinessInformationEndUser(args: {
  friendlyName: string;
  legalCompanyName: string;
  ein: string;
  entityType: string;
  industry: string;
  website: string | null;
  description: string;
}): Promise<EndUserResource> {
  return twilioRequest<EndUserResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/EndUsers`,
    {
      FriendlyName: args.friendlyName,
      Type: "customer_profile_business_information",
      Attributes: JSON.stringify({
        business_name: args.legalCompanyName,
        business_registration_number: args.ein,
        business_identity: "direct_customer",
        business_industry: args.industry,
        business_type: args.entityType,
        business_registration_identifier: "EIN",
        business_regions_of_operation: "USA_AND_CANADA",
        website_url: args.website ?? "",
        social_media_profile_urls: "",
      }),
    }
  );
}

export async function createAuthorizedRepEndUser(args: {
  friendlyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  businessTitle: string;
}): Promise<EndUserResource> {
  return twilioRequest<EndUserResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/EndUsers`,
    {
      FriendlyName: args.friendlyName,
      Type: "authorized_representative_1",
      Attributes: JSON.stringify({
        first_name: args.firstName,
        last_name: args.lastName,
        email: args.email,
        phone_number: args.phone,
        job_position: args.title,
        business_title: args.businessTitle,
      }),
    }
  );
}

export type AddressResource = { sid: string };

export async function createAddress(args: {
  customerName: string;
  street: string;
  street2: string | null;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
}): Promise<AddressResource> {
  const cfg = getPlatformConfig();
  if (!cfg) throw new Error("Platform Twilio is not configured");
  return twilioRequest<AddressResource>(
    "POST",
    `${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(
      cfg.masterAccountSid
    )}/Addresses.json`,
    {
      CustomerName: args.customerName,
      Street: args.street,
      Street2: args.street2 ?? undefined,
      City: args.city,
      Region: args.region,
      PostalCode: args.postalCode,
      IsoCountry: args.isoCountry,
    }
  );
}

export async function attachToCustomerProfile(args: {
  customerProfileSid: string;
  objectSid: string;
}): Promise<void> {
  await twilioRequest<unknown>(
    "POST",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(
      args.customerProfileSid
    )}/EntityAssignments`,
    { ObjectSid: args.objectSid }
  );
}

export type TrustProductResource = { sid: string; status: string };

export async function createA2pTrustProduct(args: {
  friendlyName: string;
  email: string;
  statusCallback: string | null;
}): Promise<TrustProductResource> {
  return twilioRequest<TrustProductResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/TrustProducts`,
    {
      FriendlyName: args.friendlyName,
      Email: args.email,
      PolicySid: POLICY_A2P_TRUST_PRODUCT,
      StatusCallback: args.statusCallback ?? undefined,
    }
  );
}

export async function fetchTrustProduct(
  sid: string
): Promise<TrustProductResource> {
  return twilioRequest<TrustProductResource>(
    "GET",
    `${TRUST_HUB_BASE}/v1/TrustProducts/${encodeURIComponent(sid)}`
  );
}

export async function attachToTrustProduct(args: {
  trustProductSid: string;
  objectSid: string;
}): Promise<void> {
  await twilioRequest<unknown>(
    "POST",
    `${TRUST_HUB_BASE}/v1/TrustProducts/${encodeURIComponent(
      args.trustProductSid
    )}/EntityAssignments`,
    { ObjectSid: args.objectSid }
  );
}

export async function attachA2pProfileInfoEndUser(args: {
  trustProductSid: string;
  companyType: string;
  stockExchange: string | null;
  stockTicker: string | null;
}): Promise<EndUserResource> {
  const endUser = await twilioRequest<EndUserResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/EndUsers`,
    {
      FriendlyName: "A2P trust product profile info",
      Type: "us_a2p_messaging_profile_information",
      Attributes: JSON.stringify({
        company_type: args.companyType,
        ...(args.stockExchange ? { stock_exchange: args.stockExchange } : {}),
        ...(args.stockTicker ? { stock_ticker: args.stockTicker } : {}),
      }),
    }
  );
  await attachToTrustProduct({
    trustProductSid: args.trustProductSid,
    objectSid: endUser.sid,
  });
  return endUser;
}

export async function submitTrustProduct(
  sid: string
): Promise<TrustProductResource> {
  return twilioRequest<TrustProductResource>(
    "POST",
    `${TRUST_HUB_BASE}/v1/TrustProducts/${encodeURIComponent(sid)}`,
    { Status: "pending-review" }
  );
}

export type BrandRegistrationResource = {
  sid: string;
  status: string;
  failure_reason: string | null;
};

export async function createBrandRegistration(args: {
  customerProfileSid: string;
  trustProductSid: string;
  brandType: "STANDARD" | "SOLE_PROPRIETOR";
  skipAutomaticSecondaryVetting: boolean;
}): Promise<BrandRegistrationResource> {
  return twilioRequest<BrandRegistrationResource>(
    "POST",
    `${MESSAGING_BASE}/v1/a2p/BrandRegistrations`,
    {
      CustomerProfileBundleSid: args.customerProfileSid,
      A2PProfileBundleSid: args.trustProductSid,
      BrandType: args.brandType,
      SkipAutomaticSecVet: args.skipAutomaticSecondaryVetting ? "true" : "false",
    }
  );
}

export async function fetchBrandRegistration(
  sid: string
): Promise<BrandRegistrationResource> {
  return twilioRequest<BrandRegistrationResource>(
    "GET",
    `${MESSAGING_BASE}/v1/a2p/BrandRegistrations/${encodeURIComponent(sid)}`
  );
}

export type MessagingServiceResource = { sid: string };

export async function createMessagingService(args: {
  friendlyName: string;
  inboundRequestUrl: string | null;
  statusCallback: string | null;
}): Promise<MessagingServiceResource> {
  return twilioRequest<MessagingServiceResource>(
    "POST",
    `${MESSAGING_BASE}/v1/Services`,
    {
      FriendlyName: args.friendlyName,
      InboundRequestUrl: args.inboundRequestUrl ?? undefined,
      InboundMethod: args.inboundRequestUrl ? "POST" : undefined,
      StatusCallback: args.statusCallback ?? undefined,
      UseInboundWebhookOnNumber: "false",
    }
  );
}

export type CampaignResource = {
  sid: string;
  status: string;
  failure_reason: string | null;
};

export async function createCampaign(args: {
  messagingServiceSid: string;
  brandRegistrationSid: string;
  description: string;
  messageSamples: string[];
  messageFlow: string;
  usAppToPersonUsecase: string;
  hasEmbeddedLinks: boolean;
  hasEmbeddedPhone: boolean;
  optInKeywords: string[];
  optInMessage: string;
  optOutKeywords: string[];
  optOutMessage: string;
  helpKeywords: string[];
  helpMessage: string;
}): Promise<CampaignResource> {
  return twilioRequest<CampaignResource>(
    "POST",
    `${MESSAGING_BASE}/v1/Services/${encodeURIComponent(
      args.messagingServiceSid
    )}/Compliance/Usa2p`,
    {
      BrandRegistrationSid: args.brandRegistrationSid,
      Description: args.description,
      MessageSamples: args.messageSamples,
      MessageFlow: args.messageFlow,
      UsAppToPersonUsecase: args.usAppToPersonUsecase,
      HasEmbeddedLinks: args.hasEmbeddedLinks ? "true" : "false",
      HasEmbeddedPhone: args.hasEmbeddedPhone ? "true" : "false",
      OptInKeywords: args.optInKeywords,
      OptInMessage: args.optInMessage,
      OptOutKeywords: args.optOutKeywords,
      OptOutMessage: args.optOutMessage,
      HelpKeywords: args.helpKeywords,
      HelpMessage: args.helpMessage,
    }
  );
}

export async function fetchCampaign(args: {
  messagingServiceSid: string;
  campaignSid: string;
}): Promise<CampaignResource> {
  return twilioRequest<CampaignResource>(
    "GET",
    `${MESSAGING_BASE}/v1/Services/${encodeURIComponent(
      args.messagingServiceSid
    )}/Compliance/Usa2p/${encodeURIComponent(args.campaignSid)}`
  );
}

export type AvailableNumber = { phone_number: string };

export async function findAvailableLocalNumber(args: {
  areaCode: string;
}): Promise<string | null> {
  const cfg = getPlatformConfig();
  if (!cfg) throw new Error("Platform Twilio is not configured");
  const params = new URLSearchParams({
    AreaCode: args.areaCode,
    SmsEnabled: "true",
    VoiceEnabled: "true",
    Limit: "1",
  });
  const res = await fetch(
    `${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(
      cfg.masterAccountSid
    )}/AvailablePhoneNumbers/US/Local.json?${params.toString()}`,
    { headers: { Authorization: masterAuthHeader() } }
  );
  const data = (await res.json().catch(() => ({}))) as {
    available_phone_numbers?: AvailableNumber[];
  };
  if (!res.ok) {
    throw new Error(
      `Twilio number search ${res.status}: ${JSON.stringify(data)}`
    );
  }
  const first = data.available_phone_numbers?.[0];
  return first?.phone_number ?? null;
}

export type IncomingPhoneNumber = { sid: string; phone_number: string };

export async function purchasePhoneNumber(args: {
  phoneNumber: string;
  friendlyName: string;
  smsUrl: string | null;
  voiceUrl: string | null;
}): Promise<IncomingPhoneNumber> {
  const cfg = getPlatformConfig();
  if (!cfg) throw new Error("Platform Twilio is not configured");
  return twilioRequest<IncomingPhoneNumber>(
    "POST",
    `${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(
      cfg.masterAccountSid
    )}/IncomingPhoneNumbers.json`,
    {
      PhoneNumber: args.phoneNumber,
      FriendlyName: args.friendlyName.slice(0, 64),
      SmsUrl: args.smsUrl ?? undefined,
      SmsMethod: args.smsUrl ? "POST" : undefined,
      VoiceUrl: args.voiceUrl ?? undefined,
      VoiceMethod: args.voiceUrl ? "POST" : undefined,
    }
  );
}

export async function attachNumberToMessagingService(args: {
  messagingServiceSid: string;
  phoneNumberSid: string;
}): Promise<void> {
  await twilioRequest<unknown>(
    "POST",
    `${MESSAGING_BASE}/v1/Services/${encodeURIComponent(
      args.messagingServiceSid
    )}/PhoneNumbers`,
    { PhoneNumberSid: args.phoneNumberSid }
  );
}
// US Trust Hub Policy SIDs are platform-wide constants published by Twilio:
//   POLICY_SECONDARY_CUSTOMER_PROFILE — RNdfbf3fae0e1107f8aded0e7cead80bf5
//   POLICY_A2P_TRUST_PRODUCT          — RNb0d4771c2c98518d916a3d4cd70a8f8b
// Hardcoded above; Twilio has not rotated these and a future change would
// be a breaking API event we'd need to follow regardless.
