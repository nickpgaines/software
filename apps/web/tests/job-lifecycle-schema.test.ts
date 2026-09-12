import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import test from "node:test";
import { loadRealPaymentDb } from "./helpers/payment-harness.mjs";

test("lifecycle outbox migration upgrades legacy claims to unknown and defaults tenant time zone", async () => {
  const directory = mkdtempSync(join(tmpdir(), "lifecycle-schema-"));
  const url = `file:${join(directory, "migration.db")}`;
  const fixture = createClient({ url });
  await fixture.executeMultiple(`
    CREATE TABLE _schema_version (id INTEGER PRIMARY KEY, version INTEGER);
    INSERT INTO _schema_version VALUES (1,21);
    CREATE TABLE company (id INTEGER PRIMARY KEY, name TEXT, address TEXT, phone TEXT, updated_at TEXT DEFAULT (datetime('now')));
    INSERT INTO company (id,name) VALUES (1,'Legacy tenant');
    CREATE TABLE job_lifecycle_notifications (
      id INTEGER PRIMARY KEY, company_id INTEGER, job_id INTEGER, step TEXT,
      outcome TEXT NOT NULL DEFAULT 'claimed', message_id INTEGER, error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(job_id,step));
    INSERT INTO job_lifecycle_notifications (company_id,job_id,step,outcome)
      VALUES (1,7,'en_route','claimed'), (1,7,'arrived','sent');
  `);
  const previous = [process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN, process.env.TURSO_LOCAL_REPLICA_PATH];
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = "local-test";
  delete process.env.TURSO_LOCAL_REPLICA_PATH;
  try {
    const db = await loadRealPaymentDb("?lifecycle-migration");
    const rows = await db.prepare("SELECT outcome, attempt_count, body FROM job_lifecycle_notifications ORDER BY id").all<{ outcome: string; attempt_count: number; body: string | null }>();
    assert.deepEqual(rows.map(row => [row.outcome,row.attempt_count,row.body]), [["unknown",0,null],["sent",0,null]]);
    assert.equal((await db.prepare("SELECT time_zone FROM company WHERE id=1").get<{ time_zone: string }>())?.time_zone, "America/New_York");
    const columns = await db.prepare("PRAGMA table_info(job_lifecycle_notifications)").all<{ name: string }>();
    for (const column of ["customer_id", "body", "attempt_count", "locked_at", "last_attempt_at", "retry_requested_at", "retry_requested_by"]) assert.ok(columns.some(c => c.name === column), column);
    const indexes = await db.prepare("PRAGMA index_list(job_lifecycle_notifications)").all<{ name: string }>();
    assert.ok(indexes.some(i => i.name === "idx_job_lifecycle_notifications_pending"));
    // A second cold start must preserve the terminal outcome and custom zone.
    await db.prepare("UPDATE company SET time_zone='America/Chicago' WHERE id=1").run();
    const restarted = await loadRealPaymentDb("?lifecycle-restarted");
    assert.equal((await restarted.prepare("SELECT outcome FROM job_lifecycle_notifications WHERE id=1").get<{ outcome: string }>())?.outcome, "unknown");
    assert.equal((await restarted.prepare("SELECT time_zone FROM company WHERE id=1").get<{ time_zone: string }>())?.time_zone, "America/Chicago");
  } finally {
    for (const [key, value] of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "TURSO_LOCAL_REPLICA_PATH"].map((key,index) => [key,previous[index]])) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
    fixture.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
