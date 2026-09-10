import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { loadRegistration, loadRegistrationRoute, registrationDatabase } from "./helpers/sms-registration-harness.mjs";

const { advanceRegistration } = await loadRegistration();
const { GET } = await loadRegistrationRoute();
const originalFetch = globalThis.fetch;
const envKeys = ["TWILIO_MASTER_ACCOUNT_SID", "TWILIO_MASTER_AUTH_TOKEN", "TWILIO_PRIMARY_CUSTOMER_PROFILE_SID"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let db: ReturnType<typeof registrationDatabase>;
let requests: Array<{ url: string; method: string; body: string }>;

beforeEach(() => {
  for (const key of envKeys) process.env[key] = "test-only";
  requests = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  db?.close();
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
  db.prepare("UPDATE sms_brand_registrations SET legal_company_name = ?, ein = ?").run("Corrected Cleaning LLC", "98-7654321");
  twilioResponses({ sid: "BUprofile", status: "twilio-rejected" });
  const result = await advanceRegistration(1, { retryFailed: true });
  assert.equal(result.state, "customer_profile_pending");
  const business = requests.find((r) => new URLSearchParams(r.body).get("Type") === "customer_profile_business_information");
  assert.ok(business);
  const attributes = JSON.parse(new URLSearchParams(business.body).get("Attributes") || "{}");
  assert.equal(attributes.business_name, "Corrected Cleaning LLC");
  assert.equal(attributes.business_registration_number, "987654321");
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
