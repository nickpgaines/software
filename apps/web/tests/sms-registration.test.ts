import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  loadRegistration,
  loadRegistrationInput,
  loadRegistrationRoute,
  registrationDatabase,
} from "./helpers/sms-registration-harness.mjs";

const {
  advanceRegistration,
  entityTypeToA2p,
  isApproved,
  isFailed,
  isPending,
} = await loadRegistration();
const { GET } = await loadRegistrationRoute();
const { validateSmsRegistrationForm: validate } = await loadRegistrationInput();
const originalFetch = globalThis.fetch;
const envKeys = [
  "TWILIO_MASTER_ACCOUNT_SID",
  "TWILIO_MASTER_AUTH_TOKEN",
  "TWILIO_PRIMARY_CUSTOMER_PROFILE_SID",
  "TWILIO_TRUST_HUB_NOTIFICATION_EMAIL",
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let db: ReturnType<typeof registrationDatabase>;
let requests: Array<{ url: string; method: string; body: string }>;

beforeEach(() => {
  for (const key of envKeys) process.env[key] = "test-only";
  process.env.TWILIO_TRUST_HUB_NOTIFICATION_EMAIL =
    "forge-notify@example.com";
  requests = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  db?.close();
  db = undefined!;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function twilioResponses(profile: Record<string, unknown>, evaluations: unknown[] = []) {
  globalThis.fetch = async (input, init) => {
    const request = { url: String(input), method: init?.method || "GET", body: String(init?.body || "") };
    requests.push(request);
    if (request.url.endsWith("/Evaluations")) return Response.json({ results: evaluations });
    if (request.url.endsWith("/CustomerProfiles/BUprofile")) return Response.json(profile);
    if (request.method === "POST") return Response.json({ sid: "BUreplacement", status: "pending-review" });
    throw new Error(`Unexpected Twilio request: ${request.method} ${request.url}`);
  };
}

test("reports final business-ID rejection even when preliminary validation passed", async () => {
  db = registrationDatabase("customer_profile_pending");
  twilioResponses(
    { sid: "BUprofile", status: "twilio-rejected", errors: [{ code: 18602 }] },
    [{ status: "compliant", results: [{ passed: true, fields: [] }] }],
  );

  const result = await advanceRegistration(1);
  assert.equal(result.state, "customer_profile_failed");
  assert.match(result.error || "", /18602/);
  assert.match(result.error || "", /legal.*name.*EIN/i);
  const stored = db.prepare("SELECT a2p_registration_state, a2p_registration_error FROM company WHERE id = 1").get();
  assert.equal(stored.a2p_registration_state, "customer_profile_failed");
  assert.equal(stored.a2p_registration_error, result.error);
});

test("keeps an unknown final rejection code so support can identify it", async () => {
  db = registrationDatabase("customer_profile_pending");
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected", errors: [{ code: 19999, message: "Additional verification required" }] });
  const result = await advanceRegistration(1);
  assert.match(result.error || "", /19999/);
  assert.match(result.error || "", /Additional verification required/);
});

test("turns common Twilio rejection codes into corrective guidance", async () => {
  db = registrationDatabase("customer_profile_pending");
  twilioResponses({
    sid: "BUprofile",
    status: "twilio-rejected",
    errors: [{ code: 18601 }, { code: 18604 }, { code: 18606 }],
  });
  const result = await advanceRegistration(1);
  assert.match(result.error || "", /18601.*legal.*name.*website/i);
  assert.match(result.error || "", /18604.*authorized representative/i);
  assert.match(result.error || "", /18606.*email.*domain.*website/i);
});

test("retains field-level validation failures when no final error is available", async () => {
  db = registrationDatabase("customer_profile_pending");
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected", errors: [] }, [
    { status: "noncompliant", results: [{ object_type: "business", passed: false, fields: [
      { object_field: "website_url", passed: false, failure_reason: "Website is required" },
    ] }] },
  ]);
  const result = await advanceRegistration(1);
  assert.match(result.error || "", /Website is required/);
});

test("refreshing a rejected registration preserves the rejection without creating another profile", async () => {
  db = registrationDatabase("customer_profile_failed");
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected", errors: [{ code: 18602 }] });
  const result = await advanceRegistration(1);
  assert.equal(result.state, "customer_profile_failed");
  assert.equal(result.error, "Existing rejection");
  assert.equal(requests.filter((r) => r.method === "POST").length, 0);
  assert.equal(db.prepare("SELECT twilio_customer_profile_sid FROM company WHERE id = 1").get().twilio_customer_profile_sid, "BUprofile");
});

test("an explicit resubmission creates a new profile with the corrected form values", async () => {
  db = registrationDatabase("customer_profile_failed");
  db.prepare(`UPDATE sms_brand_registrations
                 SET legal_company_name = ?, ein = ?, entity_type = ?,
                     social_media_profile_urls = ?`).run(
    "Corrected Cleaning LLC",
    "98-7654321",
    "Partnership",
    "https://www.facebook.com/correctedcleaning",
  );
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected" });
  const result = await advanceRegistration(1, { retryFailed: true });
  assert.equal(result.state, "customer_profile_pending");
  const profile = requests.find((r) => r.method === "POST" && r.url.endsWith("/CustomerProfiles"));
  assert.ok(profile);
  assert.equal(
    new URLSearchParams(profile.body).get("Email"),
    "forge-notify@example.com",
  );
  const business = requests.find((r) => new URLSearchParams(r.body).get("Type") === "customer_profile_business_information");
  assert.ok(business);
  const attributes = JSON.parse(new URLSearchParams(business.body).get("Attributes") || "{}");
  assert.equal(attributes.business_name, "Corrected Cleaning LLC");
  assert.equal(attributes.business_registration_number, "987654321");
  assert.equal(attributes.business_identity, "direct_customer");
  assert.equal(attributes.business_type, "Partnership");
  assert.equal(attributes.social_media_profile_urls, "https://www.facebook.com/correctedcleaning");
});

const validForm = {
  legal_company_name: "Example Cleaning LLC",
  entity_type: "LLC",
  ein: "12-3456789",
  address_line1: "1 Main Street",
  city: "Washington",
  region: "DC",
  postal_code: "20001",
  business_email: "owner@example.com",
  business_phone: "2025550100",
  business_website: "https://example.com",
  monthly_volume: "under_1k",
  confirmed_authorized: true,
  confirmed_aup_tcpa: true,
  confirmed_consent: true,
};

test("requires a supported business entity type", () => {
  assert.match(validate({ ...validForm, entity_type: "" }) || "", /entity type.*required/i);
  assert.match(validate({ ...validForm, entity_type: "Cooperative" }) || "", /valid business entity type/i);
  assert.match(validate({ ...validForm, entity_type: "Non-Profit Corporation" }) || "", /valid business entity type/i);
  assert.match(validate({ ...validForm, entity_type: "Public Corporation" }) || "", /valid business entity type/i);
});

test("requires literal true for every registration attestation", () => {
  for (const [field, message] of [
    ["confirmed_authorized", /authorized to register/i],
    ["confirmed_aup_tcpa", /AUP and TCPA/i],
    ["confirmed_consent", /provided consent/i],
  ] as const) {
    for (const value of ["true", 1, {}, []]) {
      assert.match(validate({ ...validForm, [field]: value } as never) || "", message);
    }
  }
});

test("normalizes exact Twilio provider statuses", () => {
  for (const status of ["PENDING", "PENDING_REVIEW", "IN_REVIEW", "IN_PROGRESS", " pending-review "]) {
    assert.equal(isPending(status), true, status);
  }
  for (const status of ["TWILIO_APPROVED", "APPROVED", "COMPLIANT", "VERIFIED", " twilio-approved "]) {
    assert.equal(isApproved(status), true, status);
  }
  for (const status of ["TWILIO_REJECTED", "REJECTED", "FAILED", "NONCOMPLIANT", " twilio-rejected "]) {
    assert.equal(isFailed(status), true, status);
  }
});

test("reads the exact campaign_status field returned by Twilio", async () => {
  db = registrationDatabase("campaign_pending");
  db.prepare(`UPDATE company SET
    twilio_messaging_service_sid = 'MGservice',
    twilio_campaign_sid = 'QEcampaign',
    sms_dedicated_number = '+12025550199'
    WHERE id = 1`).run();
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method || "GET",
      body: String(init?.body || ""),
    });
    return Response.json({
      sid: "QEcampaign",
      campaign_status: "VERIFIED",
      failure_reason: null,
    });
  };

  const result = await advanceRegistration(1);
  assert.equal(result.state, "campaign_approved");
  assert.equal(result.done, true);
});

test("keeps an approved campaign retryable when no phone number is available", async () => {
  db = registrationDatabase("campaign_approved");
  db.prepare(`UPDATE company SET
    twilio_messaging_service_sid = 'MGservice',
    twilio_campaign_sid = 'QEcampaign',
    a2p_registration_approved_at = '2026-09-01 12:00:00'
    WHERE id = 1`).run();
  let inventoryAvailable = false;
  globalThis.fetch = async (input, init) => {
    const request = {
      url: String(input),
      method: init?.method || "GET",
      body: String(init?.body || ""),
    };
    requests.push(request);
    if (request.url.includes("/AvailablePhoneNumbers/US/Local.json")) {
      return Response.json({
        available_phone_numbers: inventoryAvailable
          ? [{ phone_number: "+12025550199" }]
          : [],
      });
    }
    if (request.url.endsWith("/IncomingPhoneNumbers.json")) {
      return Response.json({ sid: "PNnew", phone_number: "+12025550199" });
    }
    if (request.url.endsWith("/PhoneNumbers")) return Response.json({});
    throw new Error(`Unexpected Twilio request: ${request.method} ${request.url}`);
  };

  const unavailable = await advanceRegistration(1);
  assert.equal(unavailable.state, "campaign_approved");
  assert.match(unavailable.error || "", /phone number.*not available|no phone numbers/i);
  let stored = db.prepare(`SELECT a2p_registration_state,
    a2p_registration_approved_at, sms_dedicated_number
    FROM company WHERE id = 1`).get();
  assert.equal(stored.a2p_registration_state, "campaign_approved");
  assert.equal(stored.a2p_registration_approved_at, "2026-09-01 12:00:00");
  assert.equal(stored.sms_dedicated_number, null);

  inventoryAvailable = true;
  const retried = await advanceRegistration(1);
  assert.equal(retried.state, "campaign_approved");
  assert.equal(retried.error, null);
  stored = db.prepare(`SELECT a2p_registration_state, sms_dedicated_number
    FROM company WHERE id = 1`).get();
  assert.equal(stored.a2p_registration_state, "campaign_approved");
  assert.equal(stored.sms_dedicated_number, "+12025550199");
  assert.equal(
    requests.some((request) => request.url.includes("/Compliance/Usa2p")),
    false
  );
});

for (const failureStage of ["purchase", "attachment"] as const) {
  test(`keeps an approved campaign retryable after phone number ${failureStage} failure`, async () => {
    db = registrationDatabase("campaign_approved");
    db.prepare(`UPDATE company SET
      twilio_messaging_service_sid = 'MGservice',
      twilio_campaign_sid = 'QEcampaign'
      WHERE id = 1`).run();
    globalThis.fetch = async (input, init) => {
      const request = {
        url: String(input),
        method: init?.method || "GET",
        body: String(init?.body || ""),
      };
      requests.push(request);
      if (request.url.includes("/AvailablePhoneNumbers/US/Local.json")) {
        return Response.json({
          available_phone_numbers: [{ phone_number: "+12025550199" }],
        });
      }
      if (request.url.endsWith("/IncomingPhoneNumbers.json")) {
        if (failureStage === "purchase") {
          return Response.json(
            { message: "simulated purchase failure" },
            { status: 500 }
          );
        }
        return Response.json({ sid: "PNnew", phone_number: "+12025550199" });
      }
      if (request.url.endsWith("/PhoneNumbers")) {
        return Response.json(
          { message: "simulated attachment failure" },
          { status: 500 }
        );
      }
      throw new Error(`Unexpected Twilio request: ${request.method} ${request.url}`);
    };

    const result = await advanceRegistration(1);

    assert.equal(result.state, "campaign_approved");
    assert.match(result.error || "", new RegExp(`phone number.*${failureStage}`, "i"));
    const stored = db.prepare(`SELECT a2p_registration_state,
      twilio_campaign_sid, sms_dedicated_number
      FROM company WHERE id = 1`).get();
    assert.equal(stored.a2p_registration_state, "campaign_approved");
    assert.equal(stored.twilio_campaign_sid, "QEcampaign");
    assert.equal(stored.sms_dedicated_number, null);
    assert.equal(
      requests.some((request) => request.url.includes("/Compliance/Usa2p")),
      false
    );
  });
}

test("explicit resubmission preserves a rejected brand and directs support correction", async () => {
  db = registrationDatabase("brand_failed");
  db.prepare("UPDATE company SET twilio_brand_sid = 'BNexisting' WHERE id = 1").run();

  const result = await advanceRegistration(1, { retryFailed: true });

  assert.equal(result.state, "brand_failed");
  assert.match(result.error || "", /contact support/i);
  assert.match(result.error || "", /existing brand/i);
  const stored = db.prepare("SELECT a2p_registration_state, twilio_brand_sid FROM company WHERE id = 1").get();
  assert.equal(stored.a2p_registration_state, "brand_failed");
  assert.equal(stored.twilio_brand_sid, "BNexisting");
  assert.equal(requests.length, 0);
});

test("explicit resubmission preserves a rejected campaign and directs support correction", async () => {
  db = registrationDatabase("campaign_failed");
  db.prepare(`UPDATE company SET
    twilio_messaging_service_sid = 'MGexisting',
    twilio_campaign_sid = 'QEexisting'
    WHERE id = 1`).run();

  const result = await advanceRegistration(1, { retryFailed: true });

  assert.equal(result.state, "campaign_failed");
  assert.match(result.error || "", /contact support/i);
  assert.match(result.error || "", /existing campaign/i);
  const stored = db.prepare("SELECT a2p_registration_state, twilio_campaign_sid FROM company WHERE id = 1").get();
  assert.equal(stored.a2p_registration_state, "campaign_failed");
  assert.equal(stored.twilio_campaign_sid, "QEexisting");
  assert.equal(requests.length, 0);
});

test("repeated rejected-resource submissions keep support guidance stable", async () => {
  db = registrationDatabase("brand_failed");
  db.prepare("UPDATE company SET twilio_brand_sid = 'BNexisting' WHERE id = 1").run();

  const first = await advanceRegistration(1, { retryFailed: true });
  const second = await advanceRegistration(1, { retryFailed: true });

  assert.equal(second.error, first.error);
});

test("uses Twilio's EIN-backed standard brand path for sole proprietors", () => {
  assert.deepEqual(entityTypeToA2p("Sole Proprietorship"), {
    brandType: "STANDARD",
    companyType: "private",
    businessType: "Sole Proprietorship",
  });
});

test("requires a real HTTPS business website instead of a social profile", () => {
  assert.match(validate({ ...validForm, business_website: "n/a" }) || "", /valid HTTPS/i);
  assert.match(
    validate({ ...validForm, business_website: "https://facebook.com/example" }) || "",
    /social media.*separate/i,
  );
});

test("accepts a separate optional HTTPS social profile", () => {
  assert.equal(
    validate({
      ...validForm,
      social_media_profile_urls: "https://www.instagram.com/examplecleaning",
    }),
    null,
  );
  assert.match(
    validate({ ...validForm, social_media_profile_urls: "instagram.com/examplecleaning" }) || "",
    /social media.*HTTPS/i,
  );
});

test("opening the registration panel reconciles a stale pending rejection", async () => {
  db = registrationDatabase("customer_profile_pending");
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected", errors: [{ code: 18602 }] }, [
    { status: "compliant", results: [] },
  ]);
  const response = await GET(new Request("https://www.forgecrm.app/api/sms/registration"));
  const data = await response.json();
  assert.equal(data.company.a2p_registration_state, "customer_profile_failed");
  assert.match(data.company.a2p_registration_error, /18602/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("repeated Refresh status requests leave a rejection actionable without resubmitting", async () => {
  db = registrationDatabase("customer_profile_pending");
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected", errors: [{ code: 18602 }] });
  for (let i = 0; i < 3; i++) {
    const response = await GET(new Request("https://www.forgecrm.app/api/sms/registration?refresh=1"));
    const data = await response.json();
    assert.equal(data.company.a2p_registration_state, "customer_profile_failed");
    assert.match(data.company.a2p_registration_error, /18602/);
  }
  assert.equal(requests.filter((r) => r.method === "POST").length, 0);
});
