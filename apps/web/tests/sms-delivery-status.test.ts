import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { loadMessageStatusRoute, registrationDatabase } from "./helpers/sms-registration-harness.mjs";

const { POST } = await loadMessageStatusRoute();

for (const kind of ["master", "subaccount", "byo"]) {
  test(`${kind} delivery callback survives the apex redirect and stores the actual failure`, async t => {
    const db = registrationDatabase("not_started");
    t.after(() => db.close());
    db.exec(`CREATE TABLE messaging_settings (company_id INTEGER, account_sid TEXT, auth_token TEXT, from_number TEXT);
      INSERT INTO messaging_settings VALUES (1,'ACbyo','byo-token','+12025550199');
      CREATE TABLE messages (company_id INTEGER, provider_sid TEXT, direction TEXT, status TEXT, error_code INTEGER, error TEXT);
      INSERT INTO messages VALUES (1,'SMmessage','outbound','accepted',NULL,NULL);`);
    for (const [key, value] of Object.entries({ TWILIO_MASTER_ACCOUNT_SID: "ACmaster", TWILIO_MASTER_AUTH_TOKEN: "master-token", NEXT_PUBLIC_APP_URL: "https://forgecrm.app" })) {
      const previous = process.env[key]; process.env[key] = value;
      t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
    }
    const account = kind === "master" ? "ACmaster" : kind === "subaccount" ? "ACtest" : "ACbyo";
    const token = kind === "master" ? "master-token" : kind === "subaccount" ? "test-token" : "byo-token";
    const fields = { AccountSid: account, MessageSid: "SMmessage", MessageStatus: "undelivered", ErrorCode: "30034" };
    const signature = createHmac("sha1", token).update("https://forgecrm.app/api/messages/status" + Object.keys(fields).sort().map(key => key + fields[key as keyof typeof fields]).join("")).digest("base64");
    const req = (signature: string) => new Request("https://www.forgecrm.app/api/messages/status", { method: "POST", headers: { "x-twilio-signature": signature, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
    assert.equal((await POST(req("invalid"))).status, 403);
    assert.equal(db.prepare("SELECT status FROM messages").all()[0].status, "accepted");
    assert.equal((await POST(req(signature))).status, 204);
    const row = db.prepare("SELECT status, error_code, error FROM messages").all()[0];
    assert.equal(row.status, "undelivered");
    assert.equal(row.error_code, 30034);
    assert.match(String(row.error), /unregistered/i);
  });
}

for (const kind of ["subaccount", "byo"]) {
  test(`${kind} signature cannot update another company's message`, async t => {
    const db = registrationDatabase("not_started");
    t.after(() => db.close());
    db.exec(`CREATE TABLE messaging_settings (company_id INTEGER, account_sid TEXT, auth_token TEXT, from_number TEXT);
      INSERT INTO messaging_settings VALUES (1,'ACbyo','byo-token','+12025550199');
      CREATE TABLE messages (company_id INTEGER, provider_sid TEXT, direction TEXT, status TEXT, error_code INTEGER, error TEXT);
      INSERT INTO messages VALUES (2,'SMother','outbound','accepted',NULL,NULL);`);
    const fields = { AccountSid: kind === "subaccount" ? "ACtest" : "ACbyo", MessageSid: "SMother", MessageStatus: "delivered" };
    const url = "https://www.forgecrm.app/api/messages/status";
    const signature = createHmac("sha1", kind === "subaccount" ? "test-token" : "byo-token")
      .update(url + Object.keys(fields).sort().map(key => key + fields[key as keyof typeof fields]).join("")).digest("base64");
    await POST(new Request(url, { method: "POST", headers: { "x-twilio-signature": signature }, body: new URLSearchParams(fields) }));
    assert.equal(db.prepare("SELECT status FROM messages").all()[0].status, "accepted");
  });
}
