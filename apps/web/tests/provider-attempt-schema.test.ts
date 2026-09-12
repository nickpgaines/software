import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import test from "node:test";
import { loadRealPaymentDb } from "./helpers/payment-harness.mjs";

test("provider attempt migration upgrades version 22 and durably scopes creation reservations", async () => {
  const directory = mkdtempSync(join(tmpdir(), "provider-attempt-schema-"));
  const url = `file:${join(directory, "migration.db")}`;
  const fixture = createClient({ url });
  await fixture.executeMultiple("CREATE TABLE _schema_version (id INTEGER PRIMARY KEY, version INTEGER); INSERT INTO _schema_version VALUES (1,22)");
  const previous = [process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN, process.env.TURSO_LOCAL_REPLICA_PATH];
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = "local-test";
  delete process.env.TURSO_LOCAL_REPLICA_PATH;
  try {
    const db = await loadRealPaymentDb("?provider-attempt-migration");
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
    assert.ok(tables.some(row => row.name === "sms_number_provisioning"));
    assert.ok(tables.some(row => row.name === "saved_card_payment_attempts"));
    await db.prepare("INSERT OR IGNORE INTO company (id, name) VALUES (1, 'One'), (2, 'Two')").run();
    await db.prepare("INSERT INTO sms_number_provisioning (company_id, phone_number) VALUES (1,'+12025550199')").run();
    await assert.rejects(db.prepare("INSERT INTO sms_number_provisioning (company_id, phone_number) VALUES (1,'+12025550198')").run(), /UNIQUE/);
    const insert = db.prepare(`INSERT INTO saved_card_payment_attempts
      (company_id, idempotency_key, attempt_id, request_fingerprint, stripe_account_id, payment_date)
      VALUES (?, 'saved-card:one-attempt', ?, 'fingerprint', ?, '2026-09-11')`);
    await insert.run(1, "attempt-one", "acct_1");
    await assert.rejects(insert.run(1, "attempt-two", "acct_1"), /UNIQUE/);
    await insert.run(2, "attempt-two", "acct_2");
    const restarted = await loadRealPaymentDb("?provider-attempt-restarted");
    assert.equal((await restarted.prepare("SELECT phone_number FROM sms_number_provisioning WHERE company_id=1").get<{ phone_number: string }>())?.phone_number, "+12025550199");
    assert.equal((await restarted.prepare("SELECT COUNT(*) AS count FROM saved_card_payment_attempts").get<{ count: number }>())?.count, 2);
    await db.prepare("DELETE FROM company WHERE id=1").run();
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM sms_number_provisioning").get<{ count: number }>())?.count, 0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM saved_card_payment_attempts").get<{ count: number }>())?.count, 1);
  } finally {
    for (const [index, key] of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "TURSO_LOCAL_REPLICA_PATH"].entries()) {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    }
    fixture.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
