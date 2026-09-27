import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import test from "node:test";
import { loadRealDbModule, loadRealPaymentDb } from "./helpers/payment-harness.mjs";

test("legacy job backfill uses one set-based database batch", async () => {
  const dbModule = (await loadRealDbModule("?legacy-backfill-contract")) as {
    backfillLegacyJobData?: (db: { exec(sql: string): Promise<void> }) => Promise<void>;
  };
  assert.equal(typeof dbModule.backfillLegacyJobData, "function");

  const batches: string[] = [];
  await dbModule.backfillLegacyJobData!({
    async exec(sql: string) {
      batches.push(sql);
    },
  });

  assert.equal(batches.length, 1, "job count must not change the database round-trip count");
  assert.match(batches[0], /INSERT OR IGNORE INTO job_assignments[\s\S]*SELECT/);
  assert.match(batches[0], /UPDATE jobs SET end_time/);
});

test("version 16 upgrades production-sized partially migrated legacy jobs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "schema-v16-upgrade-"));
  const url = `file:${join(directory, "migration.db")}`;
  const fixture = createClient({ url });
  await fixture.executeMultiple(`
    CREATE TABLE _schema_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
    INSERT INTO _schema_version VALUES (1, 16);
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT,
      address TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO customers (id, name) VALUES (1, 'Migration customer');
    CREATE TABLE staff (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO staff (id, name) VALUES (1, 'Sales'), (2, 'Technician');
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      price_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      subscription_id INTEGER,
      subscription_visit_index INTEGER,
      salesperson_id INTEGER,
      technician_id INTEGER,
      end_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    WITH RECURSIVE sequence(id) AS (
      VALUES (1)
      UNION ALL SELECT id + 1 FROM sequence WHERE id < 2118
    )
    INSERT INTO jobs (
      id, customer_id, scheduled_at, duration_minutes,
      salesperson_id, technician_id, end_time
    )
    SELECT
      id,
      1,
      '2026-09-12T12:00:00.000Z',
      CASE WHEN id = 1 THEN -30 WHEN id = 2 THEN 0 ELSE 60 END,
      CASE WHEN id = 1 THEN 0 WHEN id % 2 = 0 THEN 1 END,
      CASE WHEN id = 1 THEN 0 WHEN id % 4 = 0 THEN 2 END,
      CASE
        WHEN id = 3 THEN '1999-01-01T00:00:00.000Z'
        WHEN id = 4 THEN ''
        WHEN id % 3 = 0 THEN '2026-09-12T13:00:00.000Z'
      END
    FROM sequence;
    CREATE TABLE job_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('sales', 'tech')),
      UNIQUE (job_id, staff_id, role)
    );
    INSERT INTO job_assignments (job_id, staff_id, role)
    VALUES (2, 1, 'sales'), (4, 2, 'tech');
  `);

  const previous = [
    process.env.TURSO_DATABASE_URL,
    process.env.TURSO_AUTH_TOKEN,
    process.env.TURSO_LOCAL_REPLICA_PATH,
  ];
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = "local-test";
  delete process.env.TURSO_LOCAL_REPLICA_PATH;

  try {
    const db = await loadRealPaymentDb("?schema-v16-production-size");
    const version = await db
      .prepare("SELECT version FROM _schema_version WHERE id = 1")
      .get<{ version: number }>();
    const assignments = await db
      .prepare("SELECT role, COUNT(*) AS count FROM job_assignments GROUP BY role ORDER BY role")
      .all<{ role: string; count: number }>();
    const missingEnds = await db
      .prepare("SELECT COUNT(*) AS count FROM jobs WHERE end_time IS NULL OR end_time = ''")
      .get<{ count: number }>();
    const durationEdges = await db
      .prepare("SELECT id, end_time FROM jobs WHERE id IN (1, 2, 3, 4) ORDER BY id")
      .all<{ id: number; end_time: string }>();

    assert.equal(version?.version, 24);
    assert.deepEqual(assignments, [
      { role: "sales", count: 1059 },
      { role: "tech", count: 529 },
    ]);
    assert.equal(missingEnds?.count, 0);
    assert.deepEqual(durationEdges, [
      { id: 1, end_time: "2026-09-12T11:30:00.000Z" },
      { id: 2, end_time: "2026-09-12T13:00:00.000Z" },
      { id: 3, end_time: "1999-01-01T00:00:00.000Z" },
      { id: 4, end_time: "2026-09-12T13:00:00.000Z" },
    ]);
  } finally {
    for (const [index, key] of [
      "TURSO_DATABASE_URL",
      "TURSO_AUTH_TOKEN",
      "TURSO_LOCAL_REPLICA_PATH",
    ].entries()) {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }
    fixture.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
