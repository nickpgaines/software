import assert from "node:assert/strict";
import { test } from "node:test";
import { lifecycleDatabase } from "./helpers/lifecycle-harness.mjs";
import { setStatusStep } from "../src/lib/job-status-transitions.ts";
import { autoCompleteSteps } from "../src/lib/payment-job-completion.ts";
import type { Db } from "../src/lib/db.ts";
import { dispatchJobLifecycleNotification } from "../src/lib/job-lifecycle-dispatch.ts";

test("lifecycle outbox survives a status commit without immediate delivery", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  assert.equal(await setStatusStep(db, 12, "en_route", 1), true);
  const row = await db.prepare("SELECT outcome, body, customer_id, attempt_count FROM job_lifecycle_notifications").get();
  assert.equal(row?.outcome, "pending");
  assert.equal(row?.customer_id, 90);
  assert.match(row?.body, /on their way/);
  assert.equal(row?.attempt_count, 0);
});

test("lifecycle outbox failure rolls back the status transition", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await db.exec("CREATE TRIGGER reject_enqueue BEFORE INSERT ON job_lifecycle_notifications BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;");
  await assert.rejects(setStatusStep(db, 12, "en_route", 1), /outbox unavailable/);
  assert.equal((await db.prepare("SELECT en_route_at FROM jobs WHERE id=12").get())?.en_route_at, null);
});

test("payment lifecycle outbox records skipped synthetic steps and pending completion together", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await db.transaction((tx: Db) => autoCompleteSteps(tx, 12, 1));
  const rows = await db.prepare("SELECT step, outcome FROM job_lifecycle_notifications ORDER BY step").all();
  assert.deepEqual(rows.map((r: { step: string; outcome: string }) => [r.step,r.outcome]), [["arrived","skipped"],["completed","pending"],["en_route","skipped"],["started","skipped"]]);
});

test("lifecycle outbox concurrent immediate and cron drainers submit once", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  const outbox = await import("../src/lib/job-lifecycle-outbox.ts");
  let sends = 0;
  const send = async () => { sends++; return { ok: true, messageId: 88, status: "queued", error: null }; };
  await Promise.all([
    ...Array.from({ length: 5 }, () => outbox.deliverJobLifecycleNotification({ db, companyId: 1, jobId: 12, step: "en_route", send })),
    ...Array.from({ length: 5 }, () => outbox.runPendingJobLifecycleNotifications({ db, send })),
  ]);
  assert.equal(sends, 1);
  const row = await db.prepare("SELECT outcome, attempt_count FROM job_lifecycle_notifications").get();
  assert.equal(row?.outcome, "sent"); assert.equal(row?.attempt_count, 1);
});

test("lifecycle outbox failed provider submission is durable and never auto-retried", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  const outbox = await import("../src/lib/job-lifecycle-outbox.ts");
  let sends = 0;
  const send = async () => { sends++; return { ok: false, messageId: 88, status: "failed", error: "provider rejected" }; };
  const counts = await outbox.runPendingJobLifecycleNotifications({ db, send });
  await outbox.runPendingJobLifecycleNotifications({ db, send });
  assert.equal(sends, 1); assert.equal(counts.failed, 1);
  assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "failed");
});

test("lifecycle outbox stale sending becomes unknown without another submission", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  await db.exec("UPDATE job_lifecycle_notifications SET outcome='sending', attempt_count=1, locked_at=datetime('now','-11 minutes')");
  const outbox = await import("../src/lib/job-lifecycle-outbox.ts");
  let sends = 0;
  const send = async () => { sends++; throw new Error("must not retry"); };
  const counts = await outbox.runPendingJobLifecycleNotifications({ db, send });
  await outbox.runPendingJobLifecycleNotifications({ db, send });
  assert.equal(sends, 0); assert.equal(counts.unknown, 1);
  assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "unknown");
});

test("lifecycle outbox enqueue preparation error still commits a failed diagnostic", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await db.exec("DROP TABLE customization_settings");
  await setStatusStep(db, 12, "en_route", 1);
  const row = await db.prepare("SELECT outcome, error FROM job_lifecycle_notifications").get();
  assert.equal(row?.outcome, "failed"); assert.match(row?.error, /customization_settings/);
  assert.ok((await db.prepare("SELECT en_route_at FROM jobs WHERE id=12").get())?.en_route_at);
});

test("lifecycle outbox concurrent cron runs count each provider submission only once", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  const outbox = await import("../src/lib/job-lifecycle-outbox.ts");
  const send = async () => ({ ok: true, messageId: 88, status: "queued", error: null });
  let transactions = 0;
  let first: Promise<{ sent: number; failed: number; unknown: number }>;
  const delayed: Db = { ...db, transaction: async fn => {
    if (++transactions > 1) await first;
    return db.transaction(fn);
  } };
  first = outbox.runPendingJobLifecycleNotifications({ db, send });
  const results = await Promise.all([first, outbox.runPendingJobLifecycleNotifications({ db: delayed, send })]);
  assert.equal(results.reduce((sum, counts) => sum + counts.sent, 0), 1);
});

test("lifecycle outbox unavailable immediate claim returns a queued warning after commit", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  const unavailable: Db = { ...db, transaction: async () => { throw new Error("temporarily offline"); } };
  const result = await dispatchJobLifecycleNotification({ db: unavailable, companyId: 1, jobId: 12, step: "en_route", changed: true, clear: false,
    send: async () => { throw new Error("must not send"); },
  });
  assert.equal(result?.outcome, "pending");
  assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "pending");
});

test("lifecycle outbox ambiguous provider throws are unknown and never replayed", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  const outbox = await import("../src/lib/job-lifecycle-outbox.ts");
  let sends = 0;
  const send = async () => { sends++; throw new Error("connection lost after acceptance"); };
  await outbox.runPendingJobLifecycleNotifications({ db, send });
  await outbox.runPendingJobLifecycleNotifications({ db, send });
  assert.equal(sends, 1);
  assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "unknown");
});

test("lifecycle outbox interrupted result persistence becomes unknown and does not retry", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await setStatusStep(db, 12, "en_route", 1);
  const outbox = await import("../src/lib/job-lifecycle-outbox.ts");
  await db.exec("CREATE TRIGGER reject_sent BEFORE UPDATE ON job_lifecycle_notifications WHEN NEW.outcome='sent' BEGIN SELECT RAISE(ABORT,'lost database'); END;");
  let sends = 0;
  const send = async () => { sends++; return { ok: true, messageId: 88, status: "queued", error: null }; };
  const result = await outbox.deliverJobLifecycleNotification({ db, companyId: 1, jobId: 12, step: "en_route", send });
  assert.equal(result?.outcome, "unknown");
  assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "sending");
  await db.exec("UPDATE job_lifecycle_notifications SET locked_at=datetime('now','-11 minutes')");
  await outbox.runPendingJobLifecycleNotifications({ db, send });
  assert.equal(sends, 1);
  assert.equal((await db.prepare("SELECT outcome FROM job_lifecycle_notifications").get())?.outcome, "unknown");
});
