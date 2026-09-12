import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleDatabase } from "./helpers/lifecycle-harness.mjs";
import { autoCompleteSteps, dispatchPaymentCompletionNotification } from "../src/lib/payment-job-completion.ts";
import { effects, loadPaymentRoutes, paymentDatabase } from "./helpers/payment-harness.mjs";

test("payment completion does not redispatch an existing or cancelled finish", async t => {
  for (const [status, completed] of [["completed", "2026-08-20T00:00:00.000Z"], ["cancelled", null]]) {
    const { db, close } = lifecycleDatabase(); t.after(close);
    await db.prepare("UPDATE jobs SET status=?, completed_at=? WHERE id=12").run(status, completed);
    assert.equal(await autoCompleteSteps(db, 12, 1), false);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM job_lifecycle_notifications WHERE step='completed'").get())?.count, 0);
  }
});

test("payment completion delivers only the prepared finish after commit", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  assert.equal(await autoCompleteSteps(db, 12, 1), true);
  let sends = 0;
  const result = await dispatchPaymentCompletionNotification({ db, companyId: 1, jobId: 12, changed: true }, {
    send: async message => { sends++; assert.match(message.body, /completed|finished|complete/); return { ok: true, messageId: 88, status: "queued", error: null }; },
  });
  assert.equal(result?.ok, true); assert.equal(sends, 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM job_lifecycle_notifications WHERE outcome='skipped'").get())?.count, 3);
});

test("payment routes commit pending lifecycle completion even when immediate dispatch never delivers", async t => {
  const routes = await loadPaymentRoutes();
  for (const name of ["manual", "stripe-confirm", "charge-saved-card"]) {
    const database = paymentDatabase(); t.after(database.close);
    const body = name === "stripe-confirm" ? { payment_intent_id: "pi_test" } : { amount_cents: 1000, tip_cents: 100, method: "cash" };
    const response = await routes[name](new Request("https://example.com/api/jobs/12/payments", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "attempt-outbox" }, body: JSON.stringify(body),
    }), { params: { id: "12" } });
    assert.equal(response.status, 201, name);
    assert.equal(effects.completions.length, 1);
    assert.equal(database.sqlite.prepare("SELECT outcome FROM job_lifecycle_notifications WHERE step='completed'").get()?.outcome, "pending");
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get()?.count, 1);
  }
});

test("payment route outbox failure rolls back payment and all lifecycle timestamps", async t => {
  const routes = await loadPaymentRoutes();
  const database = paymentDatabase(); t.after(database.close);
  database.sqlite.exec("CREATE TRIGGER reject_finish BEFORE INSERT ON job_lifecycle_notifications WHEN NEW.step='completed' BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;");
  await assert.rejects(routes.manual(new Request("https://example.com/api/jobs/12/payments", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "attempt-outbox" }, body: JSON.stringify({ amount_cents: 1000, method: "cash" }),
  }), { params: { id: "12" } }), /outbox unavailable/);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get()?.count, 0);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM job_lifecycle_notifications").get()?.count, 0);
  assert.equal(database.sqlite.prepare("SELECT completed_at FROM jobs WHERE id=12").get()?.completed_at, null);
});
