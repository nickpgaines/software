import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { loadRegistrationWebhook, registrationDatabase } from "./helpers/sms-registration-harness.mjs";

const names = ["customer-profile-status", "brand-status", "campaign-status"] as const;
const routes = Object.fromEntries(await Promise.all(names.map(async name => [name, await loadRegistrationWebhook(name)])));
const originalFetch = globalThis.fetch;
const envKeys = ["TWILIO_MASTER_ACCOUNT_SID", "TWILIO_MASTER_AUTH_TOKEN", "NEXT_PUBLIC_APP_URL"];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
type TestDatabase = ReturnType<typeof registrationDatabase> & {
  transaction: (work: (database: TestDatabase) => unknown) => Promise<unknown>;
};
let db: TestDatabase;
let reads = 0;

beforeEach(() => {
  process.env.TWILIO_MASTER_ACCOUNT_SID = "ACmaster";
  process.env.TWILIO_MASTER_AUTH_TOKEN = "master-token";
  process.env.NEXT_PUBLIC_APP_URL = "https://forgecrm.app";
  reads = 0;
});
afterEach(() => {
  db?.close();
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function fixture(state = "customer_profile_pending") {
  db = registrationDatabase(state) as TestDatabase;
  db.exec(`CREATE TABLE sms_registration_leases (
    company_id INTEGER PRIMARY KEY, lease_token TEXT, expires_at TEXT, updated_at TEXT
  ); UPDATE company SET twilio_brand_sid='BNbrand', twilio_trust_product_sid='BUtrust',
    twilio_campaign_sid='QEcampaign', twilio_messaging_service_sid='MGservice', sms_tier='trial'`);
  db.transaction = async (work: (database: typeof db) => unknown) => work(db);
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method ?? "GET", "GET", "rejections must never resubmit or buy resources");
    reads++;
    if (String(input).endsWith("/Evaluations")) return Response.json({ results: [] });
    return Response.json({ sid: "BUprofile", status: "twilio-rejected", campaign_status: "FAILED", errors: [{ code: 18602 }], failure_reason: "Needs correction" });
  };
}

function request(name: string, method: string, params: Record<string, string>, options: { token?: string; signedOrigin?: string; headers?: Record<string, string> } = {}) {
  const path = `/api/twilio/webhooks/${name}`;
  const query = method === "GET" ? `?${new URLSearchParams(params)}` : "";
  const signedUrl = `${options.signedOrigin ?? "https://www.forgecrm.app"}${path}${query}`;
  const signatureInput = signedUrl + (method === "POST" ? Object.keys(params).sort().map(k => k + params[k]).join("") : "");
  const signature = createHmac("sha1", options.token ?? "test-token").update(signatureInput).digest("base64");
  return new Request(`https://www.forgecrm.app${path}${query}`, {
    method,
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature, ...options.headers },
    ...(method === "POST" ? { body: new URLSearchParams(params) } : {}),
  });
}

for (const [name, state, sid, key] of [
  ["customer-profile-status", "customer_profile_pending", "BUprofile", "CustomerProfileSid"],
  ["customer-profile-status", "trust_product_pending", "BUtrust", "TrustProductSid"],
  ["brand-status", "brand_pending", "BNbrand", "BrandSid"],
  ["campaign-status", "campaign_pending", "QEcampaign", "CampaignSid"],
]) {
  for (const method of ["GET", "POST"]) {
    test(`${method} ${state} callback persists Twilio's actual rejection, not its claimed approval`, async () => {
      fixture(state);
      const handler = routes[name][method];
      assert.equal(typeof handler, "function", `${method} callback must be supported`);
      const params: Record<string, string> = method === "GET" ? { sid, account_sid: "ACtest", status: "approved" } : { [key]: sid, AccountSid: "ACtest", Status: "approved" };
      const response = await handler(request(name, method, params));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const row = db.prepare("SELECT a2p_registration_state, sms_tier FROM company").all()[0];
      assert.equal(row.a2p_registration_state, state.replace("_pending", "_failed"));
      assert.equal(row.sms_tier, "trial");
      assert.ok(reads > 0);
    });
  }
}

for (const method of ["GET", "POST"]) {
  for (const invalid of ["missing signature", "wrong token", "foreign account", "spoofed forwarded host"]) {
    test(`${method} rejects ${invalid} without advancing registration`, async () => {
      fixture();
      const handler = routes["customer-profile-status"][method];
      assert.equal(typeof handler, "function");
      const req = request("customer-profile-status", method, { Sid: "BUprofile", AccountSid: invalid === "foreign account" ? "ACother" : "ACtest" }, {
        ...(invalid === "wrong token" ? { token: "another-tenant-token" } : {}),
        ...(invalid === "missing signature" ? { headers: { "x-twilio-signature": "" } } : {}),
        ...(invalid === "spoofed forwarded host" ? { signedOrigin: "https://attacker.example", headers: { "x-forwarded-host": "attacker.example" } } : {}),
      });
      assert.equal((await handler(req)).status, 403);
      assert.equal(reads, 0);
      assert.equal(db.prepare("SELECT a2p_registration_state FROM company").all()[0].a2p_registration_state, "customer_profile_pending");
    });
  }
}

test("redirected Trust Hub GET accepts the configured apex URL signature with original encoding", async () => {
  fixture();
  const handler = routes["customer-profile-status"].GET;
  assert.equal(typeof handler, "function");
  const response = await handler(request("customer-profile-status", "GET", { sid: "BUprofile", status: "twilio-rejected", failure_reason: "Name & EIN do not match" }, { signedOrigin: "https://forgecrm.app" }));
  assert.equal(response.status, 200);
  assert.equal(db.prepare("SELECT a2p_registration_state FROM company").all()[0].a2p_registration_state, "customer_profile_failed");
});

test("transient provider failure returns a retryable callback response", async () => {
  fixture();
  globalThis.fetch = async () => Response.json({ message: "Temporarily unavailable" }, { status: 503 });
  const response = await routes["customer-profile-status"].POST(request("customer-profile-status", "POST", { Sid: "BUprofile" }));
  assert.equal(response.status, 503);
  assert.equal(db.prepare("SELECT a2p_registration_state FROM company").all()[0].a2p_registration_state, "customer_profile_pending");
});

for (const key of ["BundleSid", "BundleSID"]) {
  test(`Trust Hub ${key} identifies the stored trust product`, async () => {
    fixture("trust_product_pending");
    const response = await routes["customer-profile-status"].GET(request("customer-profile-status", "GET", {
      [key]: "BUtrust", AccountSid: "ACtest", Status: "in-review",
    }));
    assert.equal(response.status, 200);
    assert.equal(db.prepare("SELECT a2p_registration_state FROM company").all()[0].a2p_registration_state, "trust_product_failed");
  });
}

function redirectedBundleRequest(query: string, tamper = false) {
  const path = `/api/twilio/webhooks/customer-profile-status?${query}`;
  const signature = createHmac("sha1", "test-token").update(`https://forgecrm.app${path}`).digest("base64");
  return new Request(`https://www.forgecrm.app${path}${tamper ? "&extra=changed" : ""}`, {
    headers: { "x-twilio-signature": signature },
  });
}

test("redirected Trust Hub GET preserves identical repeated body hashes in its signed URL", async () => {
  fixture("trust_product_pending");
  const hash = "a".repeat(64);
  const query = `bodySHA256=${hash}&bodySHA256=${hash}&AccountSid=ACtest&BundleSid=BUtrust&Status=in-review&FailureReason=&Errors=`;
  const response = await routes["customer-profile-status"].GET(redirectedBundleRequest(query));
  assert.equal(response.status, 200);
  assert.equal(db.prepare("SELECT a2p_registration_state FROM company").all()[0].a2p_registration_state, "trust_product_failed");
  assert.ok(reads > 0);
});

for (const variation of ["conflicting hash", "duplicate resource", "tampered signed URL"]) {
  test(`Trust Hub redirect rejects ${variation} without advancing`, async () => {
    fixture("trust_product_pending");
    const hash = "a".repeat(64);
    const other = variation === "conflicting hash" ? "b".repeat(64) : hash;
    const query = `bodySHA256=${hash}&bodySHA256=${other}&AccountSid=ACtest&BundleSid=BUtrust${variation === "duplicate resource" ? "&BundleSid=BUtrust" : ""}`;
    const response = await routes["customer-profile-status"].GET(redirectedBundleRequest(query, variation === "tampered signed URL"));
    assert.equal(response.status, variation === "tampered signed URL" ? 403 : 400);
    assert.equal(reads, 0);
    assert.equal(db.prepare("SELECT a2p_registration_state FROM company").all()[0].a2p_registration_state, "trust_product_pending");
  });
}
