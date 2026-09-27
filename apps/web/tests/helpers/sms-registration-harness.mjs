import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

let database;
let sessionContext = {
  identity: "admin",
  staffId: null,
  companyId: 1,
  isPlatformAdmin: true,
};

// Use real SQL and the real Twilio client, replacing only the remote DB and HTTP.
export async function getDb() {
  return database;
}

export async function requireCompanyId() {
  return 1;
}

export async function getSessionContext() {
  return sessionContext;
}

export function setSessionContext(value) {
  sessionContext = value;
}

function installAliases() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/db" || specifier === "@/lib/auth") {
        return { url: import.meta.url, shortCircuit: true };
      }
      if (specifier === "next/server") return nextResolve("next/server.js", context);
      if (specifier.startsWith("@/")) {
        return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
      }
      return nextResolve(specifier, context);
    },
  });
}

export async function loadRegistration() {
  const hooks = installAliases();
  try {
    return await import("../../src/lib/sms-registration.ts");
  } finally {
    hooks.deregister();
  }
}

export async function loadRegistrationRoute() {
  const hooks = installAliases();
  try {
    return await import("../../src/app/api/sms/registration/route.ts");
  } finally {
    hooks.deregister();
  }
}

export async function loadRegistrationInput() {
  return import("../../src/lib/sms-registration-input.ts");
}

export function registrationDatabase(state) {
  database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE company (
      id INTEGER PRIMARY KEY, name TEXT, a2p_registration_state TEXT,
      a2p_registration_error TEXT, a2p_registration_started_at TEXT,
      a2p_registration_approved_at TEXT, updated_at TEXT,
      twilio_subaccount_sid TEXT, twilio_subaccount_auth_token TEXT,
      twilio_customer_profile_sid TEXT, twilio_trust_product_sid TEXT,
      twilio_brand_sid TEXT, twilio_messaging_service_sid TEXT,
      twilio_campaign_sid TEXT, sms_tier TEXT, sms_dedicated_number TEXT,
      sms_dedicated_number_sid TEXT, access_status TEXT DEFAULT 'active'
    );
    CREATE TABLE sms_brand_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER,
      submitted_at TEXT, legal_company_name TEXT, dba TEXT,
      entity_type TEXT, ein TEXT, business_email TEXT, business_phone TEXT,
      business_website TEXT, business_description TEXT, auth_rep_name TEXT,
      social_media_profile_urls TEXT, industry TEXT, monthly_volume TEXT,
      auth_rep_email TEXT, auth_rep_title TEXT, address_line1 TEXT,
      address_line2 TEXT, city TEXT, region TEXT, postal_code TEXT, iso_country TEXT,
      confirmed_authorized INTEGER, confirmed_aup_tcpa INTEGER,
      confirmed_consent INTEGER, updated_at TEXT
    );
    CREATE TABLE staff (
      id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, email TEXT,
      permission_level TEXT, custom_role_id INTEGER
    );
    CREATE TABLE custom_roles (
      id INTEGER PRIMARY KEY, company_id INTEGER, permissions TEXT
    );
    INSERT INTO staff VALUES (
      7, 1, 'Example Owner', 'owner@example.com', 'admin', NULL
    );
    INSERT INTO sms_brand_registrations (
      company_id, submitted_at, legal_company_name, dba, entity_type, ein,
      business_email, business_phone, business_website, business_description,
      auth_rep_name, social_media_profile_urls, industry, monthly_volume,
      auth_rep_email, auth_rep_title, address_line1, address_line2, city,
      region, postal_code, iso_country, confirmed_authorized,
      confirmed_aup_tcpa, confirmed_consent
    ) VALUES (
      1, '2026-09-04', 'Example Cleaning LLC', NULL, 'LLC', '12-3456789',
      'owner@example.com', '2025550100', 'https://example.com', 'Cleaning',
      'Example Owner', NULL, 'Home services', 'under_1k',
      'owner@example.com', 'Owner', '1 Main Street', NULL, 'Washington',
      'DC', '20001', 'US', 1, 1, 1
    );
  `);
  database.prepare(`INSERT INTO company (
    id, name, a2p_registration_state, a2p_registration_error,
    twilio_subaccount_sid, twilio_subaccount_auth_token,
    twilio_customer_profile_sid
  ) VALUES (1, 'Example Cleaning', ?, ?, 'ACtest', 'test-token', 'BUprofile')`)
    .run(state, state.endsWith("_failed") ? "Existing rejection" : null);
  sessionContext = {
    identity: "admin",
    staffId: null,
    companyId: 1,
    isPlatformAdmin: true,
  };
  return database;
}
