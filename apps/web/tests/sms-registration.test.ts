import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  loadRegistration,
  loadRegistrationInput,
  loadRegistrationRoute,
  registrationDatabase as createRegistrationDatabase,
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

function registrationDatabase(state: string) {
  const database = createRegistrationDatabase(state);
  database.exec(`
    CREATE TABLE sms_number_provisioning (
      company_id INTEGER PRIMARY KEY, phone_number TEXT NOT NULL,
      phone_sid TEXT, status TEXT NOT NULL DEFAULT 'purchasing',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE sms_registration_leases (
      company_id INTEGER PRIMARY KEY,
      lease_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  let transactionChain: Promise<void> = Promise.resolve();
  database.transaction = (
    work: (db: typeof database) => Promise<unknown>
  ) => {
    const run = transactionChain.then(() => work(database));
    transactionChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
  return database;
}

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

test("attachment retry reuses the number durably saved before the first attachment", async () => {
  db = registrationDatabase("campaign_approved");
  db.prepare("UPDATE company SET twilio_messaging_service_sid='MGservice', twilio_campaign_sid='QEcampaign'").run();
  let purchases = 0;
  let attachments = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/AvailablePhoneNumbers/")) return Response.json({ available_phone_numbers: [{ phone_number: "+12025550199" }] });
    if (url.endsWith("/IncomingPhoneNumbers.json") && init?.method === "POST") {
      purchases++;
      return Response.json({ sid: "PNfirst", phone_number: "+12025550199" });
    }
    if (url.endsWith("/PhoneNumbers")) {
      attachments++;
      const saved = db.prepare("SELECT phone_number, phone_sid FROM sms_number_provisioning WHERE company_id=1").get();
      assert.equal(saved?.phone_number, "+12025550199");
      assert.equal(saved?.phone_sid, "PNfirst", "purchase must be durable before attachment");
      assert.equal(new URLSearchParams(String(init?.body)).get("PhoneNumberSid"), "PNfirst");
      return attachments === 1 ? Response.json({ message: "attachment unavailable" }, { status: 500 }) : Response.json({});
    }
    throw new Error(`Unexpected request ${url}`);
  };
  await advanceRegistration(1);
  assert.equal(db.prepare("SELECT sms_dedicated_number FROM company WHERE id=1").get().sms_dedicated_number, null, "number is not active until attached");
  assert.equal((await advanceRegistration(1)).error, null);
  assert.equal(purchases, 1);
  assert.equal(attachments, 2);
  assert.equal(db.prepare("SELECT sms_dedicated_number_sid FROM company WHERE id=1").get().sms_dedicated_number_sid, "PNfirst");
});

test("attachment accepted before an error is reconciled when retry reports an existing sender", async () => {
  db = registrationDatabase("campaign_approved");
  db.prepare("UPDATE company SET twilio_messaging_service_sid='MGservice', twilio_campaign_sid='QEcampaign'").run();
  let purchases = 0;
  let attachments = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/AvailablePhoneNumbers/")) return Response.json({ available_phone_numbers: [{ phone_number: "+12025550199" }] });
    if (url.endsWith("/IncomingPhoneNumbers.json")) { purchases++; return Response.json({ sid: "PNfirst", phone_number: "+12025550199" }); }
    if (url.endsWith("/PhoneNumbers") && init?.method === "POST") {
      attachments++;
      return Response.json({ message: attachments === 1 ? "response lost" : "already attached" }, { status: attachments === 1 ? 500 : 400 });
    }
    if (url.endsWith("/PhoneNumbers/PNfirst")) {
      return attachments === 1 ? Response.json({}, { status: 404 }) : Response.json({ sid: "PNfirst", service_sid: "MGservice" });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  await advanceRegistration(1);
  assert.equal((await advanceRegistration(1)).error, null);
  assert.equal(purchases, 1);
  assert.equal(db.prepare("SELECT sms_dedicated_number_sid FROM company WHERE id=1").get().sms_dedicated_number_sid, "PNfirst");
});

for (const failure of ["network", "http500", "local_commit"] as const) {
  test(`ambiguous phone purchase ${failure} reconciles the owned number without repurchase`, async () => {
    db = registrationDatabase("campaign_approved");
    db.prepare("UPDATE company SET twilio_messaging_service_sid='MGservice', twilio_campaign_sid='QEcampaign'").run();
    if (failure === "local_commit") db.exec("CREATE TRIGGER reject_phone_sid BEFORE UPDATE ON sms_number_provisioning WHEN NEW.phone_sid IS NOT NULL BEGIN SELECT RAISE(ABORT, 'lost database'); END");
    let purchases = 0;
    let visible = false;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/AvailablePhoneNumbers/")) return Response.json({ available_phone_numbers: [{ phone_number: "+12025550199" }] });
      if (url.pathname.endsWith("/IncomingPhoneNumbers.json")) {
        if (init?.method === "POST") {
          purchases++;
          if (failure === "network") throw new Error("connection lost after purchase accepted");
          if (failure === "http500") return Response.json({ message: "server error" }, { status: 500 });
          return Response.json({ sid: "PNaccepted", phone_number: "+12025550199" });
        }
        assert.equal(url.searchParams.get("PhoneNumber"), "+12025550199");
        return Response.json({ incoming_phone_numbers: visible ? [{ sid: "PNaccepted", phone_number: "+12025550199" }] : [] });
      }
      if (url.pathname.endsWith("/PhoneNumbers")) return Response.json({});
      throw new Error(`Unexpected request ${url}`);
    };
    await advanceRegistration(1);
    if (failure === "local_commit") db.exec("DROP TRIGGER reject_phone_sid");
    assert.match((await advanceRegistration(1)).error || "", /unconfirmed|unknown|reconcil/i);
    assert.equal(purchases, 1, "an absent reconciliation result must not authorize another purchase");
    visible = true;
    assert.equal((await advanceRegistration(1)).error, null);
    assert.equal(purchases, 1);
    assert.equal(db.prepare("SELECT sms_dedicated_number_sid FROM company WHERE id=1").get().sms_dedicated_number_sid, "PNaccepted");
  });
}

test("expired registration owner cannot repurchase or overwrite the new owner's provisioning progress", async () => {
  db = registrationDatabase("campaign_approved");
  db.prepare("UPDATE company SET twilio_messaging_service_sid='MGservice', twilio_campaign_sid='QEcampaign'").run();
  let releasePurchase!: (response: Response) => void;
  let purchaseStarted!: () => void;
  const started = new Promise<void>(resolve => { purchaseStarted = resolve; });
  let purchases = 0;
  let attachments = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/AvailablePhoneNumbers/")) return Response.json({ available_phone_numbers: [{ phone_number: "+12025550199" }] });
    if (url.includes("/IncomingPhoneNumbers.json")) {
      if (init?.method === "POST") {
        purchases++;
        if (purchases === 1) { purchaseStarted(); return new Promise<Response>(resolve => { releasePurchase = resolve; }); }
        return Response.json({ sid: "PNduplicate", phone_number: "+12025550199" });
      }
      return Response.json({ incoming_phone_numbers: [{ sid: "PNaccepted", phone_number: "+12025550199" }] });
    }
    if (url.endsWith("/PhoneNumbers")) { attachments++; return Response.json({}); }
    throw new Error(`Unexpected request ${url}`);
  };
  const first = advanceRegistration(1);
  await started;
  db.prepare("UPDATE sms_registration_leases SET expires_at=datetime('now', '-6 minutes')").run();
  await advanceRegistration(1);
  db.prepare("UPDATE company SET a2p_registration_error='new owner diagnostic'").run();
  releasePurchase(Response.json({ sid: "PNaccepted", phone_number: "+12025550199" }));
  await first;
  assert.equal(purchases, 1);
  assert.equal(attachments, 1);
  const saved = db.prepare("SELECT sms_dedicated_number_sid, a2p_registration_error FROM company WHERE id=1").get();
  assert.equal(saved.sms_dedicated_number_sid, "PNaccepted");
  assert.equal(saved.a2p_registration_error, "new owner diagnostic");
});

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

test("concurrent registration advancement creates one Twilio resource", async () => {
  db = registrationDatabase("not_started");
  db.prepare(
    "UPDATE company SET twilio_customer_profile_sid = NULL WHERE id = 1"
  ).run();
  let profileCreateCount = 0;
  let releaseCreate!: () => void;
  const createBlocked = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  let createStarted!: () => void;
  const createWasStarted = new Promise<void>((resolve) => {
    createStarted = resolve;
  });
  let duplicateCreateStarted!: () => void;
  const duplicateCreateWasStarted = new Promise<void>((resolve) => {
    duplicateCreateStarted = resolve;
  });
  globalThis.fetch = async (input, init) => {
    const request = {
      url: String(input),
      method: init?.method || "GET",
      body: String(init?.body || ""),
    };
    requests.push(request);
    if (
      request.method === "POST" &&
      request.url.endsWith("/CustomerProfiles")
    ) {
      profileCreateCount++;
      createStarted();
      if (profileCreateCount === 2) duplicateCreateStarted();
      await createBlocked;
      return Response.json({ sid: "BUcreated", status: "draft" });
    }
    if (request.method === "POST") {
      return Response.json({ sid: "ITfixture", status: "pending-review" });
    }
    throw new Error(
      `Unexpected Twilio request: ${request.method} ${request.url}`
    );
  };

  const first = advanceRegistration(1);
  await createWasStarted;
  const second = advanceRegistration(1);
  await Promise.race([second, duplicateCreateWasStarted]);
  releaseCreate();
  await Promise.all([first, second]);

  assert.equal(profileCreateCount, 1);
  assert.equal(
    db.prepare(
      "SELECT twilio_customer_profile_sid FROM company WHERE id = 1"
    ).get().twilio_customer_profile_sid,
    "BUcreated"
  );
});

test("opening a stranded draft restores a recoverable error without resubmitting", async () => {
  db = registrationDatabase("customer_profile_pending");
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method || "GET", body: String(init?.body || "") });
    if (url.endsWith("/CustomerProfiles/BUprofile")) return Response.json({ sid: "BUprofile", status: "draft" });
    if (url.includes("/CustomerProfiles?")) return Response.json({ results: [
      { sid: "BUprofile", status: "draft" },
      { sid: "BUold", status: "twilio-rejected" },
    ] });
    throw new Error(`Unexpected request: ${url}`);
  };
  const response = await GET(new Request("https://www.forgecrm.app/api/sms/registration"));
  const data = await response.json();
  assert.equal(data.company.a2p_registration_state, "customer_profile_failed");
  assert.match(data.company.a2p_registration_error, /not submitted.*review.*resubmit/i);
  await advanceRegistration(1);
  assert.equal(requests.filter(r => r.method === "POST").length, 0);
  assert.equal(db.prepare("SELECT twilio_customer_profile_sid FROM company").get().twilio_customer_profile_sid, "BUprofile");

  twilioResponses({ sid: "BUprofile", status: "draft" });
  const retry = await advanceRegistration(1, { retryFailed: true });
  assert.equal(retry.state, "customer_profile_pending");
  assert.equal(requests.filter(r => r.method === "POST" && r.url.endsWith("/CustomerProfiles")).length, 1);
});

test("draft recovery finds an existing in-review profile on later pages instead of enabling a duplicate", async () => {
  db = registrationDatabase("customer_profile_pending");
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method || "GET", body: "" });
    if (url.endsWith("/BUprofile")) return Response.json({ sid: "BUprofile", status: "draft" });
    if (url.includes("PageToken=next")) return Response.json({ results: [{ sid: "BUreview", status: "pending-review" }], meta: { next_page_url: null } });
    if (url.includes("/CustomerProfiles?")) return Response.json({ results: [{ sid: "BUprofile", status: "draft" }], meta: { next_page_url: "https://trusthub.twilio.com/v1/CustomerProfiles?PageToken=next" } });
    throw new Error(`Unexpected request: ${url}`);
  };
  const result = await advanceRegistration(1);
  assert.equal(result.state, "customer_profile_pending");
  assert.equal(db.prepare("SELECT twilio_customer_profile_sid FROM company").get().twilio_customer_profile_sid, "BUreview");
  assert.ok(requests.every(r => r.method === "GET"));
});

test("failed profile discovery does not misclassify a draft as safe to retry", async () => {
  db = registrationDatabase("customer_profile_pending");
  globalThis.fetch = async (input) => String(input).endsWith("/BUprofile")
    ? Response.json({ sid: "BUprofile", status: "draft" })
    : Response.json({ message: "Temporarily unavailable" }, { status: 503 });
  const result = await advanceRegistration(1);
  assert.equal(result.state, "customer_profile_pending");
  assert.match(result.error || "", /Temporarily unavailable/);
  const response = await GET(new Request("https://www.forgecrm.app/api/sms/registration"));
  const data = await response.json();
  assert.match(data.company.a2p_registration_error || "", /Temporarily unavailable/,
    "The settings page must see status-check errors instead of silently showing in review");
});

test("draft recovery honors a profile submitted between the individual fetch and discovery", async () => {
  db = registrationDatabase("customer_profile_pending");
  globalThis.fetch = async input => String(input).endsWith("/BUprofile")
    ? Response.json({ sid: "BUprofile", status: "draft" })
    : Response.json({ results: [{ sid: "BUprofile", status: "pending-review" }] });
  const result = await advanceRegistration(1);
  assert.equal(result.state, "customer_profile_pending");
  assert.equal(result.error, null);
});

test("profile discovery never sends credentials to another origin or treats incomplete results as safe", async () => {
  for (const response of [
    { results: [], meta: { next_page_url: "https://untrusted.example/profiles" } },
    { message: "Malformed response" },
    { results: [], meta: { next_page_url: "https://trusthub.twilio.com/v1/CustomerProfiles?PageSize=50" } },
  ]) {
    db = registrationDatabase("customer_profile_pending");
    let calls = 0;
    globalThis.fetch = async input => {
      const url = String(input);
      assert.ok(url.startsWith("https://trusthub.twilio.com/"));
      calls++;
      return Response.json(url.endsWith("/BUprofile") ? { sid: "BUprofile", status: "draft" } : response);
    };
    const result = await advanceRegistration(1);
    assert.equal(result.state, "customer_profile_pending");
    assert.match(result.error || "", /Could not.*load/);
    assert.equal(calls, 2);
    db.close();
    db = undefined!;
  }
});

test("an interrupted trust-product draft also becomes recoverable without provider writes", async () => {
  db = registrationDatabase("trust_product_pending");
  db.prepare("UPDATE company SET twilio_trust_product_sid = ?").run("BUtrust");
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method || "GET", body: "" });
    return Response.json({ sid: "BUtrust", status: "draft" });
  };
  const result = await advanceRegistration(1);
  assert.equal(result.state, "trust_product_failed");
  assert.match(result.error || "", /not submitted.*review.*resubmit/i);
  assert.ok(requests.every(r => r.method === "GET"));
});
