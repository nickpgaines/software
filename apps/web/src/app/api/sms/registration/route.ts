import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import {
  getDb,
  type Company,
  type SmsBrandRegistration,
  type SmsMonthlyVolume,
} from "@/lib/db";
import { advanceRegistration } from "@/lib/sms-registration";

export const dynamic = "force-dynamic";

type RegistrationStatus = {
  registration: SmsBrandRegistration | null;
  company: Pick<
    Company,
    | "sms_tier"
    | "a2p_registration_state"
    | "a2p_registration_error"
    | "a2p_registration_started_at"
    | "a2p_registration_approved_at"
    | "sms_dedicated_number"
    | "twilio_brand_sid"
    | "twilio_campaign_sid"
  >;
};

const VOLUMES: SmsMonthlyVolume[] = ["under_1k", "1k_6k", "6k_plus"];

async function readStatus(companyId: number): Promise<RegistrationStatus> {
  const db = await getDb();
  const registration = await db
    .prepare(
      "SELECT * FROM sms_brand_registrations WHERE company_id = ? LIMIT 1"
    )
    .get<SmsBrandRegistration>(companyId);
  const company = (await db
    .prepare(
      `SELECT sms_tier, a2p_registration_state, a2p_registration_error,
              a2p_registration_started_at, a2p_registration_approved_at,
              sms_dedicated_number, twilio_brand_sid, twilio_campaign_sid
         FROM company WHERE id = ? LIMIT 1`
    )
    .get(companyId)) as RegistrationStatus["company"];
  return { registration: registration ?? null, company };
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const url = new URL(req.url);
  if (url.searchParams.get("refresh") === "1") {
    await advanceRegistration(companyId).catch(() => {});
  }
  const status = await readStatus(companyId);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

type FormPayload = Partial<{
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

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function validate(body: FormPayload): string | null {
  const required: Array<[keyof FormPayload, string]> = [
    ["legal_company_name", "Legal company name"],
    ["ein", "EIN / business number"],
    ["address_line1", "Business address"],
    ["city", "City"],
    ["region", "State / region"],
    ["postal_code", "Postal code"],
    ["business_email", "Business email"],
    ["business_phone", "Business phone"],
    ["entity_type", "Business entity type"],
    ["monthly_volume", "Estimated monthly volume"],
  ];
  for (const [k, label] of required) {
    if (!s(body[k])) return `${label} is required.`;
  }
  if (!VOLUMES.includes(s(body.monthly_volume) as SmsMonthlyVolume)) {
    return "Choose a valid monthly volume estimate.";
  }
  if (!/^\d{2}-?\d{7}$/.test(s(body.ein))) {
    return "EIN must be in format XX-XXXXXXX.";
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

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const body = (await req.json().catch(() => ({}))) as FormPayload;
  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const db = await getDb();
  const existing = await db
    .prepare(
      "SELECT id FROM sms_brand_registrations WHERE company_id = ? LIMIT 1"
    )
    .get<{ id: number }>(companyId);

  // Defaulted server-side now that the form no longer collects them: home-
  // service tenants are always low-volume "Home services," the description is
  // templated from the business name, and the authorized rep is the account
  // owner (an admin on this company).
  const legalName = s(body.legal_company_name);
  const owner = await db
    .prepare(
      "SELECT name, email FROM staff WHERE company_id = ? AND permission_level = 'admin' ORDER BY id ASC LIMIT 1"
    )
    .get<{ name: string | null; email: string | null }>(companyId);
  const fields = {
    legal_company_name: legalName,
    dba: s(body.dba) || null,
    ein: s(body.ein),
    address_line1: s(body.address_line1),
    address_line2: s(body.address_line2) || null,
    city: s(body.city),
    region: s(body.region),
    postal_code: s(body.postal_code),
    iso_country: s(body.iso_country) || "US",
    business_email: s(body.business_email),
    business_phone: s(body.business_phone),
    business_website: s(body.business_website) || null,
    industry: s(body.industry) || "Home services",
    entity_type: s(body.entity_type),
    monthly_volume: s(body.monthly_volume) || "under_1k",
    business_description:
      s(body.business_description) ||
      `${legalName} is a home-service business that sends appointment confirmations, reminders, receipts, and service follow-ups by text to its own existing customers who have given express consent.`,
    auth_rep_name: s(body.auth_rep_name) || owner?.name?.trim() || legalName,
    auth_rep_title: s(body.auth_rep_title) || "Owner",
    auth_rep_email:
      s(body.auth_rep_email) || owner?.email?.trim() || s(body.business_email),
    confirmed_authorized: body.confirmed_authorized ? 1 : 0,
    confirmed_aup_tcpa: body.confirmed_aup_tcpa ? 1 : 0,
    confirmed_consent: body.confirmed_consent ? 1 : 0,
  };

  if (existing) {
    await db
      .prepare(
        `UPDATE sms_brand_registrations SET
           legal_company_name = ?, dba = ?, ein = ?,
           address_line1 = ?, address_line2 = ?, city = ?, region = ?,
           postal_code = ?, iso_country = ?,
           business_email = ?, business_phone = ?, business_website = ?,
           industry = ?, entity_type = ?, monthly_volume = ?,
           business_description = ?,
           auth_rep_name = ?, auth_rep_title = ?, auth_rep_email = ?,
           confirmed_authorized = ?, confirmed_aup_tcpa = ?, confirmed_consent = ?,
           submitted_at = COALESCE(submitted_at, datetime('now')),
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        fields.legal_company_name,
        fields.dba,
        fields.ein,
        fields.address_line1,
        fields.address_line2,
        fields.city,
        fields.region,
        fields.postal_code,
        fields.iso_country,
        fields.business_email,
        fields.business_phone,
        fields.business_website,
        fields.industry,
        fields.entity_type,
        fields.monthly_volume,
        fields.business_description,
        fields.auth_rep_name,
        fields.auth_rep_title,
        fields.auth_rep_email,
        fields.confirmed_authorized,
        fields.confirmed_aup_tcpa,
        fields.confirmed_consent,
        existing.id
      );
  } else {
    await db
      .prepare(
        `INSERT INTO sms_brand_registrations
           (company_id, legal_company_name, dba, ein,
            address_line1, address_line2, city, region, postal_code, iso_country,
            business_email, business_phone, business_website,
            industry, entity_type, monthly_volume, business_description,
            auth_rep_name, auth_rep_title, auth_rep_email,
            confirmed_authorized, confirmed_aup_tcpa, confirmed_consent,
            submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        companyId,
        fields.legal_company_name,
        fields.dba,
        fields.ein,
        fields.address_line1,
        fields.address_line2,
        fields.city,
        fields.region,
        fields.postal_code,
        fields.iso_country,
        fields.business_email,
        fields.business_phone,
        fields.business_website,
        fields.industry,
        fields.entity_type,
        fields.monthly_volume,
        fields.business_description,
        fields.auth_rep_name,
        fields.auth_rep_title,
        fields.auth_rep_email,
        fields.confirmed_authorized,
        fields.confirmed_aup_tcpa,
        fields.confirmed_consent
      );
  }

  // Flip the state machine forward. The orchestrator catches all errors and
  // persists them as failure states; the user-facing response always succeeds
  // so the upstream isn't allowed to break the form submission UX.
  await advanceRegistration(companyId).catch((e) => {
    console.error(
      `[sms/registration] advanceRegistration threw for company ${companyId}:`,
      e
    );
  });

  const status = await readStatus(companyId);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
