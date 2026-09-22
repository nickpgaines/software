import { NextResponse } from "next/server";
import {
  getDb,
  type Company,
  type SmsBrandRegistration,
} from "@/lib/db";
import { advanceRegistration } from "@/lib/sms-registration";
import {
  requireSmsRegistrationAccess,
  SmsRegistrationAccessError,
} from "@/lib/sms-registration-access";
import {
  type SmsRegistrationFormPayload,
  validateSmsRegistrationForm,
} from "@/lib/sms-registration-input";
import { verifyPublicWebsite } from "@/lib/public-website";

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
  let companyId: number;
  try {
    ({ companyId } = await requireSmsRegistrationAccess());
  } catch (error) {
    if (error instanceof SmsRegistrationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const url = new URL(req.url);
  let status = await readStatus(companyId);
  // Reconcile in-review records on panel open as well as explicit refresh.
  // Callbacks can be missed; showing the stored state alone leaves a rejected
  // profile labelled "in review" and prevents the user from correcting it.
  if (
    status.company.a2p_registration_state.endsWith("_pending") ||
    url.searchParams.get("refresh") === "1"
  ) {
    const progress = await advanceRegistration(companyId).catch((error) => {
      console.error(`[sms/registration] status refresh failed for company ${companyId}:`, error);
      return {
        state: status.company.a2p_registration_state,
        error: "Unable to refresh registration status. Please try again shortly. Your saved details have not been changed.",
      };
    });
    status = await readStatus(companyId);
    // Provider/network failures are transient, not a new rejection. Show them
    // without persisting over a newer state written by another request.
    if (progress.error && progress.state === status.company.a2p_registration_state) {
      status.company.a2p_registration_error = progress.error;
    }
  }
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type SmsRegistrationPostDependencies = {
  verifyWebsite?: typeof verifyPublicWebsite;
  advance?: typeof advanceRegistration;
};

async function handleSmsRegistrationPost(
  req: Request,
  dependencies: SmsRegistrationPostDependencies = {}
) {
  let companyId: number;
  try {
    ({ companyId } = await requireSmsRegistrationAccess());
  } catch (error) {
    if (error instanceof SmsRegistrationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const current = await readStatus(companyId);
  if (
    current.company.sms_tier === "paid_approved" ||
    current.company.a2p_registration_state === "campaign_approved"
  ) {
    return NextResponse.json(
      { error: "This registration is already approved and is read-only." },
      { status: 409 }
    );
  }
  const body = (await req
    .json()
    .catch(() => ({}))) as SmsRegistrationFormPayload;
  const error = validateSmsRegistrationForm(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const website = new URL(s(body.business_website));
  const websiteError = await (dependencies.verifyWebsite ?? verifyPublicWebsite)(
    website
  );
  if (websiteError) {
    return NextResponse.json({ error: websiteError }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .prepare(
      "SELECT id FROM sms_brand_registrations WHERE company_id = ? LIMIT 1"
    )
    .get<{ id: number }>(companyId);

  // Home-service industry and use-case copy are standardized. If the form
  // leaves representative fields blank, fall back to the first company admin.
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
    social_media_profile_urls: s(body.social_media_profile_urls) || null,
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
    confirmed_authorized: body.confirmed_authorized === true ? 1 : 0,
    confirmed_aup_tcpa: body.confirmed_aup_tcpa === true ? 1 : 0,
    confirmed_consent: body.confirmed_consent === true ? 1 : 0,
  };

  let writeResult: { changes: number };
  if (existing) {
    writeResult = await db
      .prepare(
        `UPDATE sms_brand_registrations SET
           legal_company_name = ?, dba = ?, ein = ?,
           address_line1 = ?, address_line2 = ?, city = ?, region = ?,
           postal_code = ?, iso_country = ?,
           business_email = ?, business_phone = ?, business_website = ?,
           social_media_profile_urls = ?,
           industry = ?, entity_type = ?, monthly_volume = ?,
           business_description = ?,
           auth_rep_name = ?, auth_rep_title = ?, auth_rep_email = ?,
           confirmed_authorized = ?, confirmed_aup_tcpa = ?, confirmed_consent = ?,
           submitted_at = datetime('now'),
           updated_at = datetime('now')
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM company
              WHERE id = ?
                AND COALESCE(sms_tier, 'trial') <> 'paid_approved'
                AND COALESCE(a2p_registration_state, 'not_started') <> 'campaign_approved'
           )`
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
        fields.social_media_profile_urls,
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
        existing.id,
        companyId
      );
  } else {
    writeResult = await db
      .prepare(
        `INSERT INTO sms_brand_registrations
           (company_id, legal_company_name, dba, ein,
            address_line1, address_line2, city, region, postal_code, iso_country,
            business_email, business_phone, business_website,
            social_media_profile_urls,
            industry, entity_type, monthly_volume, business_description,
            auth_rep_name, auth_rep_title, auth_rep_email,
            confirmed_authorized, confirmed_aup_tcpa, confirmed_consent,
            submitted_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
           FROM company
          WHERE id = ?
            AND COALESCE(sms_tier, 'trial') <> 'paid_approved'
            AND COALESCE(a2p_registration_state, 'not_started') <> 'campaign_approved'`
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
        fields.social_media_profile_urls,
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
        companyId
      );
  }

  if (writeResult.changes !== 1) {
    return NextResponse.json(
      { error: "This registration is already approved and is read-only." },
      { status: 409 }
    );
  }

  // Flip the state machine forward. The orchestrator catches all errors and
  // persists them as failure states; the user-facing response always succeeds
  // so the upstream isn't allowed to break the form submission UX.
  await (dependencies.advance ?? advanceRegistration)(companyId, {
    retryFailed: true,
  }).catch((e) => {
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

export async function POST(
  req: Request,
  dependencies: SmsRegistrationPostDependencies = {}
) {
  return handleSmsRegistrationPost(req, dependencies);
}
