// Twilio Trust Hub + Messaging API client. Every call accepts an explicit
// `creds` argument — for per-tenant resources we pass that tenant's
// subaccount credentials, for the trial pool we pass master. This matches
// Twilio's ISV guidance: each customer lives inside their own subaccount
// container, with their own Auth Token signing webhooks back to us.
//
// All resource creation is idempotent at the orchestrator level: we persist
// each returned SID onto the company row before moving to the next step, and
// re-running the orchestrator skips any step whose SID is already stored.

const TRUST_HUB_BASE = "https://trusthub.twilio.com";
const MESSAGING_BASE = "https://messaging.twilio.com";
const API_BASE = "https://api.twilio.com";

const POLICY_SECONDARY_CUSTOMER_PROFILE = "RNdfbf3fae0e1107f8aded0e7cead80bf5";
const POLICY_A2P_TRUST_PRODUCT = "RNb0d4771c2c98518d916a3d4cd70a8f8b";

export type TwilioCreds = {
  accountSid: string;
  authToken: string;
};

function authHeader(creds: TwilioCreds): string {
  return (
    "Basic " +
    Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")
  );
}

async function twilioRequest<T>(
  creds: TwilioCreds,
  method: "GET" | "POST",
  url: string,
  form?: Record<string, string | string[] | undefined>
): Promise<T> {
  const body =
    form && method === "POST" ? buildForm(form).toString() : undefined;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(creds),
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

// ----- Subaccount lifecycle (called with master creds) -----

export type SubaccountResource = {
  sid: string;
  auth_token: string;
  friendly_name: string;
  status: string;
};

// Create a Twilio subaccount under the master account. The Auth Token in
// the response is the ONLY chance to capture the subaccount's signing
// secret — Twilio does not return it on subsequent fetches.
export async function createSubaccount(args: {
  masterCreds: TwilioCreds;
  friendlyName: string;
}): Promise<SubaccountResource> {
  return twilioRequest<SubaccountResource>(
    args.masterCreds,
    "POST",
    `${API_BASE}/2010-04-01/Accounts.json`,
    { FriendlyName: args.friendlyName.slice(0, 64) }
  );
}

// ----- Trust Hub resources (called with tenant subaccount creds) -----

export type CustomerProfileResource = {
  sid: string;
  status: string;
  friendly_name: string;
  policy_sid: string;
};

export async function createSecondaryCustomerProfile(args: {
  creds: TwilioCreds;
  friendlyName: string;
  email: string;
  statusCallback: string | null;
}): Promise<CustomerProfileResource> {
  return twilioRequest<CustomerProfileResource>(
    args.creds,
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

export async function fetchCustomerProfile(args: {
  creds: TwilioCreds;
  sid: string;
}): Promise<CustomerProfileResource> {
  return twilioRequest<CustomerProfileResource>(
    args.creds,
    "GET",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(args.sid)}`
  );
}

// Pull the most recent evaluation result for a Customer Profile so we can
// surface the actual rejection reason ("EIN does not match business name",
// "address could not be verified", etc.) instead of a bare "twilio-rejected".
export type EvaluationResource = {
  sid: string;
  status: string;
  results?: Array<{
    object_type?: string;
    valid?: boolean;
    failure_reason?: string;
    error_code?: number;
    fields?: Array<{
      object_field?: string;
      passed?: boolean;
      failure_reason?: string;
      error_code?: number;
    }>;
  }>;
};

export async function fetchCustomerProfileEvaluations(args: {
  creds: TwilioCreds;
  sid: string;
}): Promise<EvaluationResource[]> {
  const data = await twilioRequest<{ results?: EvaluationResource[] }>(
    args.creds,
    "GET",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(
      args.sid
    )}/Evaluations`
  );
  return data.results ?? [];
}

export function summarizeEvaluationFailures(
  evals: EvaluationResource[]
): string | null {
  for (const ev of evals) {
    if (ev.status !== "noncompliant") continue;
    const reasons: string[] = [];
    for (const r of ev.results ?? []) {
      if (r.valid) continue;
      const where = r.object_type ?? "field";
      if (r.failure_reason) {
        reasons.push(`${where}: ${r.failure_reason}`);
      }
      for (const f of r.fields ?? []) {
        if (f.passed === false && f.failure_reason) {
          reasons.push(
            `${where}.${f.object_field ?? "field"}: ${f.failure_reason}`
          );
        }
      }
    }
    if (reasons.length) return reasons.join("; ");
  }
  return null;
}

export async function submitCustomerProfile(args: {
  creds: TwilioCreds;
  sid: string;
}): Promise<CustomerProfileResource> {
  return twilioRequest<CustomerProfileResource>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(args.sid)}`,
    { Status: "pending-review" }
  );
}

export type EndUserResource = { sid: string; type: string };

export async function createBusinessInformationEndUser(args: {
  creds: TwilioCreds;
  friendlyName: string;
  legalCompanyName: string;
  ein: string;
  entityType: string;
  industry: string;
  website: string | null;
  description: string;
}): Promise<EndUserResource> {
  return twilioRequest<EndUserResource>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/EndUsers`,
    {
      FriendlyName: args.friendlyName,
      Type: "customer_profile_business_information",
      Attributes: JSON.stringify({
        business_name: args.legalCompanyName,
        business_registration_number: args.ein,
        business_identity: "isv_reseller_or_partner",
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

// Each Secondary Customer Profile must point at the ISV's approved Primary
// Customer Profile via an EndUser of type primary_customer_profile_type_business
// whose `bundle_sid` is the primary CP's SID. Without this link, the secondary
// CP evaluation fails with "Primary customer profile bundle is null".
export async function createPrimaryCustomerProfileLinkEndUser(args: {
  creds: TwilioCreds;
  friendlyName: string;
  primaryCustomerProfileSid: string;
}): Promise<EndUserResource> {
  return twilioRequest<EndUserResource>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/EndUsers`,
    {
      FriendlyName: args.friendlyName,
      Type: "primary_customer_profile_type_business",
      Attributes: JSON.stringify({
        bundle_sid: args.primaryCustomerProfileSid,
      }),
    }
  );
}

export async function createAuthorizedRepEndUser(args: {
  creds: TwilioCreds;
  friendlyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  businessTitle: string;
}): Promise<EndUserResource> {
  return twilioRequest<EndUserResource>(
    args.creds,
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
  creds: TwilioCreds;
  customerName: string;
  street: string;
  street2: string | null;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
}): Promise<AddressResource> {
  return twilioRequest<AddressResource>(
    args.creds,
    "POST",
    `${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(
      args.creds.accountSid
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
  creds: TwilioCreds;
  customerProfileSid: string;
  objectSid: string;
}): Promise<void> {
  await twilioRequest<unknown>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/CustomerProfiles/${encodeURIComponent(
      args.customerProfileSid
    )}/EntityAssignments`,
    { ObjectSid: args.objectSid }
  );
}

export type SupportingDocumentResource = { sid: string; status: string };

// Wrap a raw Address (AD…) in a customer_profile_address supporting document.
// A Customer Profile bundle rejects a bare Address (error 70002); it accepts
// the supporting document that references the address instead.
export async function createAddressSupportingDocument(args: {
  creds: TwilioCreds;
  friendlyName: string;
  addressSid: string;
}): Promise<SupportingDocumentResource> {
  return twilioRequest<SupportingDocumentResource>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/SupportingDocuments`,
    {
      FriendlyName: args.friendlyName,
      Type: "customer_profile_address",
      Attributes: JSON.stringify({ address_sids: args.addressSid }),
    }
  );
}

export type TrustProductResource = { sid: string; status: string };

export async function createA2pTrustProduct(args: {
  creds: TwilioCreds;
  friendlyName: string;
  email: string;
  statusCallback: string | null;
}): Promise<TrustProductResource> {
  return twilioRequest<TrustProductResource>(
    args.creds,
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

export async function fetchTrustProduct(args: {
  creds: TwilioCreds;
  sid: string;
}): Promise<TrustProductResource> {
  return twilioRequest<TrustProductResource>(
    args.creds,
    "GET",
    `${TRUST_HUB_BASE}/v1/TrustProducts/${encodeURIComponent(args.sid)}`
  );
}

export async function attachToTrustProduct(args: {
  creds: TwilioCreds;
  trustProductSid: string;
  objectSid: string;
}): Promise<void> {
  await twilioRequest<unknown>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/TrustProducts/${encodeURIComponent(
      args.trustProductSid
    )}/EntityAssignments`,
    { ObjectSid: args.objectSid }
  );
}

export async function attachA2pProfileInfoEndUser(args: {
  creds: TwilioCreds;
  trustProductSid: string;
  companyType: string;
  stockExchange: string | null;
  stockTicker: string | null;
}): Promise<EndUserResource> {
  const endUser = await twilioRequest<EndUserResource>(
    args.creds,
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
    creds: args.creds,
    trustProductSid: args.trustProductSid,
    objectSid: endUser.sid,
  });
  return endUser;
}

export async function submitTrustProduct(args: {
  creds: TwilioCreds;
  sid: string;
}): Promise<TrustProductResource> {
  return twilioRequest<TrustProductResource>(
    args.creds,
    "POST",
    `${TRUST_HUB_BASE}/v1/TrustProducts/${encodeURIComponent(args.sid)}`,
    { Status: "pending-review" }
  );
}

export type BrandRegistrationResource = {
  sid: string;
  status: string;
  failure_reason: string | null;
};

export async function createBrandRegistration(args: {
  creds: TwilioCreds;
  customerProfileSid: string;
  trustProductSid: string;
  brandType: "STANDARD" | "SOLE_PROPRIETOR";
  skipAutomaticSecondaryVetting: boolean;
}): Promise<BrandRegistrationResource> {
  return twilioRequest<BrandRegistrationResource>(
    args.creds,
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

export async function fetchBrandRegistration(args: {
  creds: TwilioCreds;
  sid: string;
}): Promise<BrandRegistrationResource> {
  return twilioRequest<BrandRegistrationResource>(
    args.creds,
    "GET",
    `${MESSAGING_BASE}/v1/a2p/BrandRegistrations/${encodeURIComponent(args.sid)}`
  );
}

export type MessagingServiceResource = { sid: string };

export async function createMessagingService(args: {
  creds: TwilioCreds;
  friendlyName: string;
  inboundRequestUrl: string | null;
  statusCallback: string | null;
}): Promise<MessagingServiceResource> {
  return twilioRequest<MessagingServiceResource>(
    args.creds,
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
  creds: TwilioCreds;
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
    args.creds,
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
  creds: TwilioCreds;
  messagingServiceSid: string;
  campaignSid: string;
}): Promise<CampaignResource> {
  return twilioRequest<CampaignResource>(
    args.creds,
    "GET",
    `${MESSAGING_BASE}/v1/Services/${encodeURIComponent(
      args.messagingServiceSid
    )}/Compliance/Usa2p/${encodeURIComponent(args.campaignSid)}`
  );
}

export type AvailableNumber = { phone_number: string };

export async function findAvailableLocalNumber(args: {
  creds: TwilioCreds;
  areaCode: string;
}): Promise<string | null> {
  const params = new URLSearchParams({
    AreaCode: args.areaCode,
    SmsEnabled: "true",
    VoiceEnabled: "true",
    Limit: "1",
  });
  const res = await fetch(
    `${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(
      args.creds.accountSid
    )}/AvailablePhoneNumbers/US/Local.json?${params.toString()}`,
    { headers: { Authorization: authHeader(args.creds) } }
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
  creds: TwilioCreds;
  phoneNumber: string;
  friendlyName: string;
  smsUrl: string | null;
  voiceUrl: string | null;
}): Promise<IncomingPhoneNumber> {
  return twilioRequest<IncomingPhoneNumber>(
    args.creds,
    "POST",
    `${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(
      args.creds.accountSid
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
  creds: TwilioCreds;
  messagingServiceSid: string;
  phoneNumberSid: string;
}): Promise<void> {
  await twilioRequest<unknown>(
    args.creds,
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
