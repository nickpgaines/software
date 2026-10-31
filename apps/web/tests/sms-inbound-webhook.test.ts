import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test, type TestContext } from "node:test";
import { loadInboundMessageRoute, registrationDatabase } from "./helpers/sms-registration-harness.mjs";

const { POST } = await loadInboundMessageRoute();
function fixture(t: TestContext) {
  const db = registrationDatabase("campaign_approved");
  t.after(() => db.close());
  db.exec(`ALTER TABLE company ADD COLUMN platform_phone_number TEXT;
    UPDATE company SET sms_tier='paid_approved',sms_dedicated_number='+12025550199';
    CREATE TABLE messaging_settings (company_id INTEGER, account_sid TEXT, auth_token TEXT, from_number TEXT);
    INSERT INTO messaging_settings VALUES (1,'ACbyo','byo-token','+12025550199');
    CREATE TABLE customers (id INTEGER, company_id INTEGER, phone TEXT);
    INSERT INTO customers VALUES (10,1,'+12025550123');
    CREATE TABLE messages (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER, body TEXT,
      direction TEXT, status TEXT, provider_sid TEXT, to_phone TEXT, from_phone TEXT, tier_at_send TEXT, created_at TEXT);`);
  for (const [key, value] of Object.entries({ TWILIO_MASTER_ACCOUNT_SID: "ACmaster", TWILIO_MASTER_AUTH_TOKEN: "master-token", NEXT_PUBLIC_APP_URL: "https://forgecrm.app" })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  return db;
}
function request(kind: string, to = "+12025550199", signedOrigin = "https://forgecrm.app", signatureOverride?: string) {
  const fields = { AccountSid: kind === "subaccount" ? "ACtest" : "ACbyo", MessageSid: "SMreply", From: "+12025550123", To: to, Body: "See you tomorrow" };
  const signature = createHmac("sha1", kind === "subaccount" ? "test-token" : "byo-token")
    .update(`${signedOrigin}/api/messages/webhook` + Object.keys(fields).sort().map(key => key + fields[key as keyof typeof fields]).join("")).digest("base64");
  return new Request("https://www.forgecrm.app/api/messages/webhook", { method: "POST", headers: { "x-twilio-signature": signatureOverride ?? signature }, body: new URLSearchParams(fields) });
}
for (const kind of ["subaccount", "byo"]) {
  test(`${kind} incoming reply survives the apex redirect and appears in its customer's conversation`, async t => {
    const db = fixture(t);
    assert.equal((await POST(request(kind, undefined, undefined, "invalid"))).status, 403);
    assert.equal(db.prepare("SELECT * FROM messages").all().length, 0);
    const response = await POST(request(kind));
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /doesn.t accept replies/);
    const rows = db.prepare("SELECT company_id, customer_id, direction, body FROM messages").all();
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0] }, { company_id: 1, customer_id: 10, direction: "inbound", body: "See you tomorrow" });
  });
  test(`${kind} incoming callback cannot write to a different company's number`, async t => {
    const db = fixture(t);
    db.exec(`INSERT INTO company (id,sms_tier,sms_dedicated_number) VALUES (2,'paid_approved','+12025550299');
      INSERT INTO customers VALUES (20,2,'+12025550123');`);
    const response = await POST(request(kind, "+12025550299", "https://www.forgecrm.app"));
    assert.equal(response.status, 403);
    assert.equal(db.prepare("SELECT * FROM messages").all().length, 0);
  });
}

test("shared BYO account accepts a reply for either configured company without crossing conversations", async t => {
  const db = fixture(t);
  db.exec(`INSERT INTO company (id,sms_tier,sms_dedicated_number) VALUES (2,'paid_approved','+12025550299');
    INSERT INTO messaging_settings VALUES (2,'ACbyo','byo-token','+12025550299');
    INSERT INTO customers VALUES (20,2,'+12025550123');`);
  assert.equal((await POST(request("byo", "+12025550299"))).status, 200);
  const rows = db.prepare("SELECT company_id, customer_id FROM messages").all();
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { company_id: 2, customer_id: 20 });
});
