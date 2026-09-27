import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  loadRegistrationRoute,
  registrationDatabase,
  setSessionContext,
} from "./helpers/sms-registration-harness.mjs";

const { GET, POST } = await loadRegistrationRoute();
let db: ReturnType<typeof registrationDatabase>;

afterEach(() => {
  db?.close();
  db = undefined!;
});

const validForm = {
  legal_company_name: "Updated Cleaning LLC",
  entity_type: "LLC",
  ein: "98-7654321",
  address_line1: "2 Main Street",
  city: "Washington",
  region: "DC",
  postal_code: "20002",
  business_email: "owner@updated.example",
  business_phone: "2025550199",
  business_website: "https://updated.example",
  monthly_volume: "under_1k",
  confirmed_authorized: true,
  confirmed_aup_tcpa: true,
  confirmed_consent: true,
};

function post(body = validForm) {
  return POST(
    new Request("https://www.forgecrm.app/api/sms/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    {
      verifyWebsite: async () => null,
      advance: async () => ({ state: "not_started", error: null, done: false }),
    }
  );
}

test("returns 401 before reading registration data without a session", async () => {
  db = registrationDatabase("not_started");
  setSessionContext(null);
  const response = await GET(new Request("https://www.forgecrm.app/api/sms/registration"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Not signed in" });
});

test("returns 403 to tenant staff without settings.view_all", async () => {
  db = registrationDatabase("not_started");
  db.prepare("INSERT INTO staff VALUES (8, 1, 'Sales Rep', 'rep@example.com', 'salesperson', NULL)").run();
  setSessionContext({
    identity: "rep@example.com",
    staffId: 8,
    companyId: 1,
    isPlatformAdmin: false,
  });

  const getResponse = await GET(new Request("https://www.forgecrm.app/api/sms/registration"));
  assert.equal(getResponse.status, 403);
  assert.deepEqual(await getResponse.json(), { error: "Forbidden" });

  const postResponse = await post();
  assert.equal(postResponse.status, 403);
  assert.deepEqual(await postResponse.json(), { error: "Forbidden" });
  assert.equal(
    db.prepare("SELECT legal_company_name FROM sms_brand_registrations WHERE company_id = 1").get().legal_company_name,
    "Example Cleaning LLC"
  );
});

test("allows tenant staff whose effective role includes settings.view_all", async () => {
  db = registrationDatabase("not_started");
  setSessionContext({
    identity: "owner@example.com",
    staffId: 7,
    companyId: 1,
    isPlatformAdmin: false,
  });
  const response = await GET(new Request("https://www.forgecrm.app/api/sms/registration"));
  assert.equal(response.status, 200);
});

test("rejects mutation of an approved registration", async () => {
  db = registrationDatabase("campaign_approved");
  db.prepare("UPDATE company SET sms_tier = 'paid_approved' WHERE id = 1").run();

  const response = await post();

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /already approved.*read-only/i);
  assert.equal(
    db.prepare("SELECT legal_company_name FROM sms_brand_registrations WHERE company_id = 1").get().legal_company_name,
    "Example Cleaning LLC"
  );
});

test("every accepted POST replaces submitted_at and stores literal attestations", async () => {
  db = registrationDatabase("customer_profile_failed");
  db.prepare("UPDATE sms_brand_registrations SET submitted_at = '2000-01-01 00:00:00' WHERE company_id = 1").run();

  const response = await post();

  assert.equal(response.status, 200);
  const stored = db.prepare(`SELECT submitted_at, confirmed_authorized,
    confirmed_aup_tcpa, confirmed_consent, legal_company_name
    FROM sms_brand_registrations WHERE company_id = 1`).get();
  assert.notEqual(stored.submitted_at, "2000-01-01 00:00:00");
  assert.equal(stored.confirmed_authorized, 1);
  assert.equal(stored.confirmed_aup_tcpa, 1);
  assert.equal(stored.confirmed_consent, 1);
  assert.equal(stored.legal_company_name, "Updated Cleaning LLC");
});

test("validates website reachability before writing registration data", async () => {
  db = registrationDatabase("customer_profile_failed");
  let checkedHref: string | null = null;
  const response = await POST(
    new Request("https://www.forgecrm.app/api/sms/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validForm),
    }),
    {
      verifyWebsite: async (url) => {
        checkedHref = url.href;
        return "Business website could not be reached.";
      },
      advance: async () => {
        throw new Error("advance must not run after website validation fails");
      },
    }
  );
  assert.equal(response.status, 400);
  assert.equal(checkedHref, "https://updated.example/");
  assert.equal(
    db.prepare("SELECT legal_company_name FROM sms_brand_registrations WHERE company_id = 1").get().legal_company_name,
    "Example Cleaning LLC"
  );
});

test("does not overwrite a registration approved during website validation", async () => {
  db = registrationDatabase("customer_profile_failed");
  let advanced = false;
  const response = await POST(
    new Request("https://www.forgecrm.app/api/sms/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validForm),
    }),
    {
      verifyWebsite: async () => {
        db.prepare(
          "UPDATE company SET a2p_registration_state = 'campaign_approved' WHERE id = 1"
        ).run();
        return null;
      },
      advance: async () => {
        advanced = true;
        return { state: "campaign_approved", error: null, done: true };
      },
    }
  );

  assert.equal(response.status, 409);
  assert.equal(advanced, false);
  assert.equal(
    db.prepare(
      "SELECT legal_company_name FROM sms_brand_registrations WHERE company_id = 1"
    ).get().legal_company_name,
    "Example Cleaning LLC"
  );
});
