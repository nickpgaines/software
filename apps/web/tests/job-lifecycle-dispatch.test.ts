import assert from "node:assert/strict";
import test from "node:test";
import type { Db, Stmt } from "../src/lib/db.ts";
import { DEFAULT_CUSTOMIZATIONS } from "../src/lib/customizations.ts";
import { dispatchJobLifecycleNotification } from "../src/lib/job-lifecycle-dispatch.ts";

function dispatchDb(options?: {
  claimChanges?: number;
  config?: string;
  companyName?: string;
  failConfig?: boolean;
}) {
  const outcomes: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      return {
        async get() {
          if (options?.failConfig && sql.includes("customization_settings")) {
            throw new Error("database unavailable");
          }
          if (sql.includes("customization_settings")) {
            return {
              config:
                options?.config ?? JSON.stringify(DEFAULT_CUSTOMIZATIONS),
            };
          }
          if (sql.includes("SELECT name FROM company")) {
            return { name: options?.companyName ?? "Summit Window Cleaning" };
          }
          return undefined;
        },
        async all() {
          return [];
        },
        async run(...args: unknown[]) {
          if (sql.includes("INSERT INTO job_lifecycle_notifications")) {
            return {
              changes: options?.claimChanges ?? 1,
              lastInsertRowid: 1,
            };
          }
          if (sql.includes("UPDATE job_lifecycle_notifications")) {
            outcomes.push(args);
          }
          return { changes: 1, lastInsertRowid: 1 };
        },
      } as Stmt;
    },
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(this as Db);
    },
  } as Db;
  return { db, outcomes };
}

const job = {
  id: 7,
  customerId: 19,
  customerName: "Nicholas Gaines",
  scheduledAt: "2026-08-24T15:00:00.000Z",
  totalCents: 24900,
  technicianName: "David Beazley",
};

test("sends and records a configured first lifecycle transition", async () => {
  const { db, outcomes } = dispatchDb();
  const sent: { customerId: number; body: string }[] = [];
  const result = await dispatchJobLifecycleNotification({
    db,
    companyId: 3,
    step: "en_route",
    changed: true,
    clear: false,
    job,
    send: async ({ customerId, body }) => {
      sent.push({ customerId, body });
      return {
        ok: true,
        messageId: 88,
        status: "queued",
        error: null,
      };
    },
  });

  assert.equal(result?.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].customerId, 19);
  assert.match(sent[0].body, /on their way/);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0][0], "sent");
  assert.equal(outcomes[0][1], 88);
});

test("does not send on clear, repeat, duplicate claim, or disabled block", async () => {
  let sends = 0;
  const send = async () => {
    sends += 1;
    return { ok: true, messageId: 1, status: "queued", error: null };
  };

  for (const input of [
    { changed: true, clear: true, step: "arrived" as const, db: dispatchDb().db },
    { changed: false, clear: false, step: "arrived" as const, db: dispatchDb().db },
    {
      changed: true,
      clear: false,
      step: "arrived" as const,
      db: dispatchDb({ claimChanges: 0 }).db,
    },
    { changed: true, clear: false, step: "started" as const, db: dispatchDb().db },
  ]) {
    assert.equal(
      await dispatchJobLifecycleNotification({
        ...input,
        companyId: 3,
        job,
        send,
      }),
      null
    );
  }
  assert.equal(sends, 0);
});

test("returns a warning result without rolling back when notification setup throws", async () => {
  const { db, outcomes } = dispatchDb({ failConfig: true });
  const result = await dispatchJobLifecycleNotification({
    db,
    companyId: 3,
    step: "completed",
    changed: true,
    clear: false,
    job,
    send: async () => {
      throw new Error("should not reach send");
    },
  });

  assert.deepEqual(result, {
    attempted: true,
    ok: false,
    error: "The customer text could not be prepared or delivered.",
  });
  assert.equal(outcomes[0][0], "failed");
  assert.equal(outcomes[0][2], "database unavailable");
});
