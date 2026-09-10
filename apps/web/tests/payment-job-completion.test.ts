import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Db, Stmt } from "../src/lib/db.ts";
import {
  autoCompleteSteps,
  dispatchPaymentCompletionNotification,
} from "../src/lib/payment-job-completion.ts";

function completionDb(existing: { completed_at: string | null; status: string }) {
  const skipped: string[] = [];
  const db: Db = {
    prepare(sql: string): Stmt {
      return {
        get: async <T>() =>
          (sql.includes("SELECT completed_at, status") ? existing : undefined) as T | undefined,
        all: async () => [],
        run: async (...args) => {
          if (sql.includes("job_lifecycle_notifications")) {
            skipped.push(String(args[1]));
          }
          return { lastInsertRowid: 0, changes: 1 };
        },
      };
    },
    exec: async () => undefined,
    transaction: async (fn) => fn(db),
  };
  return Object.assign(db, { skipped });
}

test("payment completion skips synthetic drive/start texts and reports a new finish", async () => {
  const db = completionDb({ completed_at: null, status: "scheduled" }) as Db & {
    skipped: string[];
  };
  const changed = await autoCompleteSteps(db, 12, 4, "2026-08-22T12:00:00.000Z");
  assert.equal(changed, true);
  assert.deepEqual(db.skipped, ["en_route", "arrived", "started"]);
});

test("payment completion does not redispatch an existing or cancelled finish", async () => {
  assert.equal(
    await autoCompleteSteps(
      completionDb({ completed_at: "2026-08-20T00:00:00.000Z", status: "completed" }),
      12,
      4
    ),
    false
  );
  assert.equal(
    await autoCompleteSteps(
      completionDb({ completed_at: null, status: "cancelled" }),
      12,
      4
    ),
    false
  );
});

test("automatic completion dispatches only the configured job-finish notification", async () => {
  const dispatched: unknown[] = [];
  const result = await dispatchPaymentCompletionNotification(
    { db: completionDb({ completed_at: null, status: "scheduled" }), companyId: 4, jobId: 12, changed: true },
    {
      getJob: async () => ({
        id: 12,
        customer_id: 90,
        customer_name: "Ada",
        scheduled_at: "2026-08-22T12:00:00.000Z",
        price_cents: 5000,
        techs: [{ name: "Grace" }],
      }),
      dispatch: async (input) => {
        dispatched.push(input);
        return { attempted: true, ok: true, messageId: 1, status: "sent", error: null };
      },
      send: async () => ({ ok: true, messageId: 1, status: "sent", error: null }),
    }
  );
  assert.equal(result?.ok, true);
  assert.equal(dispatched.length, 1);
  assert.equal((dispatched[0] as { step: string }).step, "completed");
});

test("all payment routes invoke finish dispatch after their transaction", () => {
  for (const relative of [
    "../src/app/api/jobs/[id]/payments/route.ts",
    "../src/app/api/jobs/[id]/payments/stripe-confirm/route.ts",
    "../src/app/api/jobs/[id]/payments/charge-saved-card/route.ts",
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /dispatchPaymentCompletionNotification/);
    assert.match(source, /completedChanged/);
  }
});
