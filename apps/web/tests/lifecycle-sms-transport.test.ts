import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { lifecycleDatabase, loadRealLifecycleSmsSender } from "./helpers/lifecycle-harness.mjs";
import { setStatusStep } from "../src/lib/job-status-transitions.ts";
import { runPendingJobLifecycleNotifications } from "../src/lib/job-lifecycle-outbox.ts";

const send = await loadRealLifecycleSmsSender();
type Mode = "dedicated" | "trial" | "platform" | "byo";

function fixture(t: TestContext, mode: Mode) {
  const database = lifecycleDatabase(); t.after(database.close);
  const settings = {
    TWILIO_MASTER_ACCOUNT_SID: "AC_master_test",
    TWILIO_MASTER_AUTH_TOKEN: "test-token",
    TWILIO_MESSAGING_SERVICE_SID: "MG_platform_test",
    TWILIO_TRIAL_POOL_MESSAGING_SERVICE_SID: "MG_pool_test",
  };
  for (const [name, value] of Object.entries(settings)) {
    const old = process.env[name]; process.env[name] = value;
    t.after(() => { if (old === undefined) delete process.env[name]; else process.env[name] = old; });
  }
  database.sqlite.exec(`
    ALTER TABLE customers ADD COLUMN phone TEXT DEFAULT '+13125550123';
    ALTER TABLE company ADD COLUMN sms_tier TEXT;
    ALTER TABLE company ADD COLUMN sms_dedicated_number TEXT;
    ALTER TABLE company ADD COLUMN twilio_messaging_service_sid TEXT;
    ALTER TABLE company ADD COLUMN twilio_subaccount_sid TEXT;
    ALTER TABLE company ADD COLUMN twilio_subaccount_auth_token TEXT;
    ALTER TABLE company ADD COLUMN platform_phone_number TEXT;
    CREATE TABLE messaging_settings (company_id INTEGER, account_sid TEXT, auth_token TEXT, from_number TEXT);
    CREATE TABLE sms_opt_outs (company_id INTEGER, phone TEXT, opted_out INTEGER);
    CREATE TABLE messages (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      body TEXT, direction TEXT, status TEXT, error TEXT, provider_sid TEXT, to_phone TEXT, from_phone TEXT);
  `);
  if (mode === "dedicated") database.sqlite.exec("UPDATE company SET sms_tier='paid_approved', sms_dedicated_number='+13125550124', twilio_messaging_service_sid='MG_tenant_test', twilio_subaccount_sid='AC_tenant_test', twilio_subaccount_auth_token='test-token' WHERE id=1");
  if (mode === "trial") database.sqlite.exec("UPDATE company SET sms_tier='trial' WHERE id=1");
  if (mode === "platform") database.sqlite.exec("UPDATE company SET platform_phone_number='+13125550124' WHERE id=1");
  if (mode === "byo") database.sqlite.exec("INSERT INTO messaging_settings VALUES (1,'AC_byo_test','test-token','+13125550124')");
  return database;
}

for (const mode of ["dedicated", "trial", "platform", "byo"] as const) {
  test(`lifecycle ${mode} SMS transport preserves uncertain acceptance through the real logged sender`, async t => {
    const { db } = fixture(t, mode);
    let requests = 0;
    t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
      requests++;
      assert.equal(options.method, "POST");
      assert.equal(new URLSearchParams(String(options.body)).get("To"), "+13125550123");
      throw new Error("connection reset after Twilio accepted request");
    });
    await setStatusStep(db, 12, "en_route", 1);
    const counts = await runPendingJobLifecycleNotifications({ db, send });
    await runPendingJobLifecycleNotifications({ db, send });
    assert.equal(requests, 1);
    assert.equal(counts.unknown, 1);
    const row = await db.prepare("SELECT outcome, message_id, attempt_count FROM job_lifecycle_notifications").get();
    assert.equal(row?.outcome, "unknown"); assert.equal(row?.attempt_count, 1);
    const message = await db.prepare("SELECT id, status, error, provider_sid FROM messages").get();
    assert.equal(message?.id, row?.message_id);
    assert.equal(message?.status, "unknown");
    assert.match(message?.error, /connection reset/);
    assert.equal(message?.provider_sid, null);
  });

  test(`lifecycle ${mode} SMS definitive provider rejection stays failed`, async t => {
    const { db } = fixture(t, mode);
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ code: 21610, message: "Recipient opted out" }), { status: 400 }));
    await setStatusStep(db, 12, "en_route", 1);
    assert.equal((await runPendingJobLifecycleNotifications({ db, send })).failed, 1);
    assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "failed");
    const message = await db.prepare("SELECT status, error, provider_sid FROM messages").get();
    assert.equal(message?.status, "failed"); assert.equal(message?.error, "Recipient opted out"); assert.equal(message?.provider_sid, null);
  });
}

test("lifecycle SMS pre-submission validation and configuration failures stay failed", async t => {
  for (const reason of ["phone", "opt_out", "credentials", "not_configured"]) {
    const { db, sqlite } = fixture(t, "dedicated");
    if (reason === "phone") sqlite.exec("UPDATE customers SET phone=NULL");
    if (reason === "opt_out") sqlite.exec("INSERT INTO sms_opt_outs VALUES (1,'+13125550123',1)");
    if (reason === "credentials") sqlite.exec("UPDATE company SET twilio_subaccount_auth_token=NULL");
    if (reason === "not_configured") sqlite.exec("UPDATE company SET twilio_messaging_service_sid=NULL");
    let requests = 0;
    const mock = t.mock.method(globalThis, "fetch", async () => { requests++; throw new Error("must not submit"); });
    await setStatusStep(db, 12, "en_route", 1);
    assert.equal((await runPendingJobLifecycleNotifications({ db, send })).failed, 1, reason);
    assert.equal(requests, 0);
    assert.equal((await db.prepare("SELECT status FROM messages").get())?.status, reason === "not_configured" ? "not_configured" : "failed");
    mock.mock.restore();
  }
});

test("lifecycle SMS accepted provider response keeps its queued log and provider identifier", async t => {
  const { db } = fixture(t, "dedicated");
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ sid: "SM_accepted", status: "queued" }), { status: 201 }));
  await setStatusStep(db, 12, "en_route", 1);
  assert.equal((await runPendingJobLifecycleNotifications({ db, send })).sent, 1);
  const message = await db.prepare("SELECT status, error, provider_sid FROM messages").get();
  assert.equal(message?.status, "queued"); assert.equal(message?.error, null); assert.equal(message?.provider_sid, "SM_accepted");
});
