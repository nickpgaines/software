import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Db, RunResult, Stmt } from "../src/lib/db.ts";
import {
  claimJobLifecycleNotification,
  recordJobLifecycleNotificationOutcome,
  setStatusStep,
} from "../src/lib/job-status-transitions.ts";

function recordingDb(changes: number[]) {
  const statements: { sql: string; args: unknown[] }[] = [];
  let runIndex = 0;
  const db = {
    prepare(sql: string) {
      return {
        async get() {
          return undefined;
        },
        async all() {
          return [];
        },
        async run(...args: unknown[]) {
          statements.push({ sql, args });
          return {
            changes: changes[runIndex++] ?? 0,
            lastInsertRowid: 0,
          } as RunResult;
        },
      } as Stmt;
    },
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(db as Db);
    },
  } as Db;
  return { db, statements };
}

test("reports only the first non-clear status transition as changed", async () => {
  const first = recordingDb([1]);
  assert.equal(
    await setStatusStep(first.db, 7, "en_route", 3, false),
    true
  );
  assert.match(first.statements[0].sql, /en_route_at IS NULL/);
  assert.deepEqual(first.statements[0].args.slice(-2), [7, 3]);

  const repeat = recordingDb([0]);
  assert.equal(
    await setStatusStep(repeat.db, 7, "en_route", 3, false),
    false
  );
});

test("clears only a set timestamp and never claims a notification", async () => {
  const clear = recordingDb([1]);
  assert.equal(await setStatusStep(clear.db, 7, "arrived", 3, true), true);
  assert.match(clear.statements[0].sql, /arrived_at IS NOT NULL/);
  assert.doesNotMatch(clear.statements[0].sql, /job_lifecycle_notifications/);
});

test("claims a lifecycle notification once with a tenant-scoped insert", async () => {
  const first = recordingDb([1]);
  assert.equal(
    await claimJobLifecycleNotification(first.db, 3, 7, "en_route"),
    true
  );
  assert.match(
    first.statements[0].sql,
    /ON CONFLICT\s*\(job_id, step\)\s*DO NOTHING/i
  );
  assert.match(first.statements[0].sql, /WHERE id = \? AND company_id = \?/);
  assert.deepEqual(first.statements[0].args, [3, "en_route", 7, 3]);

  const duplicate = recordingDb([0]);
  assert.equal(
    await claimJobLifecycleNotification(duplicate.db, 3, 7, "en_route"),
    false
  );
});

test("records notification outcomes with company, job, and step scope", async () => {
  const result = recordingDb([1]);
  await recordJobLifecycleNotificationOutcome(result.db, {
    companyId: 3,
    jobId: 7,
    step: "completed",
    outcome: "failed",
    messageId: 12,
    error: "provider failure",
  });
  assert.match(
    result.statements[0].sql,
    /WHERE company_id = \? AND job_id = \? AND step = \?/
  );
  assert.deepEqual(result.statements[0].args.slice(-3), [3, 7, "completed"]);
});

test("schema initializes the durable lifecycle notification ledger", () => {
  const source = readFileSync(
    new URL("../src/lib/db.ts", import.meta.url),
    "utf8"
  );
  const schemaVersion = source.match(/const SCHEMA_VERSION = (\d+)/);
  assert.ok(schemaVersion);
  assert.ok(Number(schemaVersion[1]) >= 17);
  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS job_lifecycle_notifications/
  );
  assert.match(source, /UNIQUE\s*\(job_id, step\)/);
  for (const [column, step] of [
    ["en_route_at", "en_route"],
    ["arrived_at", "arrived"],
    ["started_at", "started"],
    ["completed_at", "completed"],
  ]) {
    assert.match(
      source,
      new RegExp(
        `SELECT company_id, id, '${step}', 'skipped'[\\s\\S]+WHERE ${column} IS NOT NULL`
      )
    );
  }
});
