export type SmsRegistrationFormPayload = Partial<{
  legal_company_name: string;
  dba: string;
  ein: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  iso_country: string;
  business_email: string;
  business_phone: string;
  business_website: string;
  social_media_profile_urls: string;
  industry: string;
  entity_type: string;
  monthly_volume: string;
  business_description: string;
  auth_rep_name: string;
  auth_rep_title: string;
  auth_rep_email: string;
  confirmed_authorized: boolean;
  confirmed_aup_tcpa: boolean;
  confirmed_consent: boolean;
}>;

const VOLUMES = ["under_1k", "1k_6k", "6k_plus"] as const;
const ENTITY_TYPES = [
  "LLC",
  "Corporation",
  "Partnership",
  "Sole Proprietorship",
  "Non-Profit Corporation",
  "Public Corporation",
] as const;
const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "nextdoor.com",
  "pinterest.com",
  "threads.net",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePublicHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function isSocialHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return SOCIAL_HOSTS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

export function validateSmsRegistrationForm(
  body: SmsRegistrationFormPayload
): string | null {
  const required: Array<[keyof SmsRegistrationFormPayload, string]> = [
    ["legal_company_name", "Legal company name"],
    ["entity_type", "Business entity type"],
    ["ein", "EIN / business number"],
    ["address_line1", "Business address"],
    ["city", "City"],
    ["region", "State / region"],
    ["postal_code", "Postal code"],
    ["business_email", "Business email"],
    ["business_phone", "Business phone"],
    ["business_website", "Business website"],
    ["monthly_volume", "Estimated monthly volume"],
  ];
  for (const [key, label] of required) {
    if (!stringValue(body[key])) return `${label} is required.`;
  }
  if (
    !VOLUMES.includes(
      stringValue(body.monthly_volume) as (typeof VOLUMES)[number]
    )
  ) {
    return "Choose a valid monthly volume estimate.";
  }
  if (
    !ENTITY_TYPES.includes(
      stringValue(body.entity_type) as (typeof ENTITY_TYPES)[number]
    )
  ) {
    return "Choose a valid business entity type.";
  }
  if (!/^\d{2}-?\d{7}$/.test(stringValue(body.ein))) {
    return "EIN must be in format XX-XXXXXXX.";
  }
  const website = parsePublicHttpsUrl(stringValue(body.business_website));
  if (!website) return "Business website must be a valid HTTPS URL.";
  if (isSocialHostname(website.hostname)) {
    return "Enter the company's own website here and put social media in the separate Social media profile field.";
  }
  const social = stringValue(body.social_media_profile_urls);
  if (social && !parsePublicHttpsUrl(social)) {
    return "Social media profile must be a valid HTTPS URL.";
  }
  if (!body.confirmed_authorized) {
    return "You must confirm you're authorized to register this business.";
  }
  if (!body.confirmed_aup_tcpa) {
    return "You must confirm agreement with the SMS AUP and TCPA.";
  }
  if (!body.confirmed_consent) {
    return "You must confirm recipients have provided consent.";
  }
  return null;
}
