import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import test from "node:test";
import { loadRealPaymentDb } from "./helpers/payment-harness.mjs";

test("payment idempotency migration upgrades version 20 and preserves historical duplicate intents", async () => {
  const directory = mkdtempSync(join(tmpdir(), "payment-schema-"));
  const url = `file:${join(directory, "migration.db")}`;
  const fixture = createClient({ url });
  await fixture.executeMultiple(`
    CREATE TABLE _schema_version (id INTEGER PRIMARY KEY, version INTEGER);
    INSERT INTO _schema_version VALUES (1,20);
    CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER,
      job_id INTEGER, amount_cents INTEGER, method TEXT, payment_date TEXT,
      notes TEXT, send_email INTEGER DEFAULT 0, send_sms INTEGER DEFAULT 0,
      stripe_payment_intent_id TEXT, created_at TEXT DEFAULT (datetime('now')));
    INSERT INTO payments (company_id,job_id,amount_cents,method,payment_date,stripe_payment_intent_id)
      VALUES (1,NULL,1000,'card','2026-09-01','pi_legacy'), (1,NULL,1000,'card','2026-09-01','pi_legacy');
  `);
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  const previousReplica = process.env.TURSO_LOCAL_REPLICA_PATH;
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = "local-test";
  delete process.env.TURSO_LOCAL_REPLICA_PATH;
  try {
    const db = await loadRealPaymentDb();
    const columns = await db.prepare("PRAGMA table_info(payments)").all<{ name: string }>();
    assert.ok(columns.some(column => column.name === "idempotency_key"), "the schema fast path must not skip the payment migration");
    assert.ok(columns.some(column => column.name === "request_fingerprint"));
    const historical = await db.prepare("SELECT COUNT(*) AS count FROM payments WHERE stripe_payment_intent_id='pi_legacy'").get<{ count: number }>();
    assert.equal(historical?.count, 2);
    await db.prepare("UPDATE payments SET idempotency_key='manual:attempt-test' WHERE id=1").run();
    await assert.rejects(db.prepare("UPDATE payments SET idempotency_key='manual:attempt-test' WHERE id=2").run(), /UNIQUE/);

    // Exercise fresh payments DDL as well as ALTERs on historical tables.
    await fixture.executeMultiple("DROP TABLE payments; UPDATE _schema_version SET version=20;");
    const freshDb = await loadRealPaymentDb("?fresh-payments");
    assert.deepEqual(await freshDb.prepare("SELECT stripe_payment_intent_id, source, idempotency_key, request_fingerprint FROM payments").all(), []);
  } finally {
    if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = previousToken;
    if (previousReplica === undefined) delete process.env.TURSO_LOCAL_REPLICA_PATH; else process.env.TURSO_LOCAL_REPLICA_PATH = previousReplica;
    fixture.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
