import assert from "node:assert/strict";
import test from "node:test";
import type { Db, Stmt } from "../src/lib/db.ts";
import { DEFAULT_CUSTOMIZATIONS } from "../src/lib/customizations.ts";
import { loadCustomizations } from "../src/lib/customization-store.ts";

function dbReturning(config: string | undefined) {
  return {
    prepare() {
      return {
        async get() {
          return config === undefined ? undefined : { config };
        },
        async all() {
          return [];
        },
        async run() {
          return { changes: 0, lastInsertRowid: 0 };
        },
      } as Stmt;
    },
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(this as Db);
    },
  } as Db;
}

test("returns defaults for missing and malformed customization rows", async () => {
  assert.deepEqual(
    await loadCustomizations(dbReturning(undefined), 4),
    DEFAULT_CUSTOMIZATIONS
  );
  assert.deepEqual(
    await loadCustomizations(dbReturning("not-json"), 4),
    DEFAULT_CUSTOMIZATIONS
  );
});

test("merges partial stored customizations with current defaults", async () => {
  const config = await loadCustomizations(
    dbReturning(JSON.stringify({ messages: { drive_end: { template: "Here" } } })),
    4
  );
  assert.equal(config.messages.drive_end.template, "Here");
  assert.equal(config.messages.drive_end.enabled, true);
  assert.equal(config.messages.job_started.enabled, false);
});
