import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { loadPaymentRoutes, paymentDatabase, effects, setCompanyId, setProviderIntent, setReceiptError, setBeforeCreateReturn } from "./helpers/payment-harness.mjs";

const routes = await loadPaymentRoutes();
let database: ReturnType<typeof paymentDatabase>;
beforeEach(() => { database = paymentDatabase(); });
afterEach(() => database.close());
const manualBody = { amount_cents: 1000, tip_cents: 100, method: "cash", notes: "deposit", send_email: true, send_sms: true };
const confirmBody = { payment_intent_id: "pi_test", notes: "deposit", send_email: true, send_sms: true };
function post(route = "manual", body: object = manualBody, key: string | null = "attempt-123", jobId = 12) {
  return routes[route](new Request(`https://example.com/api/jobs/${jobId}/payments`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(key === null ? {} : { "Idempotency-Key": key }) }, body: JSON.stringify(body),
  }), { params: { id: String(jobId) } });
}

test("payment idempotency rejects missing and invalid caller keys across all routes", async () => {
  for (const route of Object.keys(routes)) {
    for (const key of [null, "short", "a".repeat(201), "bad\tkey-123"]) {
      assert.equal((await post(route, route === "stripe-confirm" ? confirmBody : manualBody, key)).status, 400, `${route}: ${key}`);
    }
  }
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get().count, 0);
  assert.equal(effects.creates.length, 0);
});

test("manual payment idempotent replay returns original partial payment without duplicate side effects", async () => {
  const first = await post();
  const original = await first.json();
  const repeat = await post();
  assert.equal(first.status, 201);
  assert.equal(repeat.status, 200);
  const replay = await repeat.json();
  assert.equal(replay.id, original.id);
  assert.equal(replay.idempotent_replay, true);
  assert.equal(original.idempotent_replay, false);
  assert.equal(original.amount_cents, 1000);
  assert.equal(original.tip_cents, 100);
  assert.equal(effects.receipts.length, 1);
  assert.equal(effects.completions.length, 1);
  assert.equal(effects.activities.length, 1);
  assert.equal(database.sqlite.prepare("SELECT status FROM jobs WHERE id=12").get().status, "completed");
});

test("payment idempotency conflicts on material changes and scopes keys by tenant", async () => {
  await post();
  for (const delta of [{ amount_cents: 2000 }, { tip_cents: 200 }, { method: "check" }, { notes: "balance" }, { send_email: false }, { send_sms: false }]) {
    assert.equal((await post("manual", { ...manualBody, ...delta })).status, 409, JSON.stringify(delta));
  }
  assert.equal((await post("manual", manualBody, "attempt-123", 13)).status, 409);
  setCompanyId(2);
  assert.equal((await post("manual", manualBody, "attempt-123", 12)).status, 404);
  assert.equal((await post("manual", manualBody, "attempt-123", 22)).status, 201);
});

test("simultaneous payment idempotent manual inserts create one durable row", async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, () => post()));
  assert.deepEqual(responses.map(r => r.status).sort(), [200,200,200,200,200,200,200,201]);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get().count, 1);
  assert.equal(effects.receipts.length, 1);
  assert.equal(effects.completions.length, 1);
});

test("concurrent payment idempotency rejects the competing changed request", async () => {
  const responses = await Promise.all([post(), post("manual", { ...manualBody, amount_cents: 2000 })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get().count, 1);
  assert.equal(effects.receipts.length, 1);
});

test("Stripe payment idempotent concurrent confirms deduplicate by intent even with different caller keys", async () => {
  const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => post("stripe-confirm", confirmBody, `confirm-${i}`)));
  assert.deepEqual(responses.map(r => r.status).sort(), [200,200,200,200,200,201]);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get().count, 1);
  assert.equal(effects.receipts.length, 1);
  assert.equal(effects.completions.length, 1);
  assert.equal((await post("stripe-confirm", { ...confirmBody, notes: "changed" })).status, 409);
});

test("Stripe payment idempotency rejects a historical intent attached to another job", async () => {
  database.sqlite.prepare("INSERT INTO payments (company_id, job_id, amount_cents, method, payment_date, stripe_payment_intent_id) VALUES (1,13,1100,'card','2026-09-11','pi_test')").run();
  setProviderIntent({ id: "pi_test", status: "succeeded", amount: 1100, amount_received: 1100, metadata: {} });
  assert.equal((await post("stripe-confirm", confirmBody)).status, 409);
  assert.equal(effects.receipts.length, 0);
});

test("Stripe payment idempotency replays matching historical rows without retroactive receipts", async () => {
  database.sqlite.prepare("INSERT INTO payments (company_id, job_id, amount_cents, tip_cents, method, payment_date, notes, send_email, send_sms, stripe_payment_intent_id) VALUES (1,12,1000,100,'card','2026-09-01','deposit',1,1,'pi_test')").run();
  const response = await post("stripe-confirm", confirmBody);
  assert.equal(response.status, 200);
  const payment = await response.json();
  assert.equal(payment.id, 1);
  assert.equal(payment.payment_date, "2026-09-01");
  assert.equal(effects.receipts.length, 0);
  assert.equal(effects.completions.length, 0);
});

test("Stripe payment idempotency keys are deterministic and connected-account scoped", async () => {
  for (const [route, kind] of [["stripe-intent", "intent"], ["terminal-intent", "terminal"], ["charge-saved-card", "saved"]]) {
    await post(route);
    await post(route);
    const creates = effects.creates.splice(0);
    assert.ok(creates.length >= 1);
    for (const create of creates) {
      assert.equal(create.options.stripeAccount, "acct_1");
      assert.equal(create.options.idempotencyKey, `forge:1:12:${kind}:attempt-123`);
    }
  }
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get().count, 1);
  assert.equal(effects.receipts.length, 1);
});

test("saved-card payment idempotency replays without calling Stripe and rejects changed receipt choices", async () => {
  const first = await post("charge-saved-card");
  assert.equal(first.status, 201);
  assert.equal((await post("charge-saved-card")).status, 200);
  for (const delta of [{ amount_cents: 2000 }, { tip_cents: 200 }, { notes: "changed" }, { send_email: false }, { send_sms: false }, { payment_method_id: 6 }, { subscription_id: 9 }]) {
    assert.equal((await post("charge-saved-card", { ...manualBody, ...delta })).status, 409, JSON.stringify(delta));
  }
  database.sqlite.prepare("DELETE FROM stripe_payment_methods").run();
  assert.equal((await post("charge-saved-card")).status, 200);
  assert.equal(effects.creates.length, 1);
  assert.equal(effects.receipts.length, 1);
});

test("concurrent saved-card payment idempotency records the provider charge and receipts once", async () => {
  const responses = await Promise.all(Array.from({ length: 5 }, () => post("charge-saved-card")));
  assert.deepEqual(responses.map(response => response.status).sort(), [200,200,200,200,201]);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get().count, 1);
  assert.equal(effects.receipts.length, 1);
  assert.equal(effects.completions.length, 1);
});

test("saved-card payment idempotency remains durable when confirmation records the charged intent first", async () => {
  setBeforeCreateReturn(async () => {
    assert.equal((await post("stripe-confirm", confirmBody)).status, 201);
  });
  assert.equal((await post("charge-saved-card")).status, 200);
  setBeforeCreateReturn(async () => {});
  assert.equal((await post("charge-saved-card")).status, 200);
  assert.equal(effects.creates.length, 1);
  assert.equal(effects.receipts.length, 1);
  assert.equal(effects.completions.length, 1);
});

test("payment idempotency keeps a committed payment successful when receipt delivery throws", async () => {
  setReceiptError(true);
  const result = await post();
  assert.equal(result.status, 201);
  const payload = await result.json();
  assert.match(payload.warning, /receipt/i);
  assert.equal(payload.lifecycle_notification.ok, true);
  assert.equal((await post()).status, 200);
  assert.equal(effects.receipts.length, 1);
});

test("browser payment idempotency preserves an attempt across retries and rotates after changed input or success", async () => {
  const modulePath = "../src/lib/payment-attempt.ts";
  const module = await import(modulePath).catch(() => null);
  assert.ok(module, "payment attempt state must be available to the modal");
  const attempt = module.createPaymentAttempt();
  const original = attempt.keyFor("job=12,amount=1000,tip=100,method=card");
  assert.match(original, /^[0-9a-f-]{36}$/);
  assert.equal(attempt.keyFor("job=12,amount=1000,tip=100,method=card"), original);
  const changed = attempt.keyFor("job=12,amount=2000,tip=100,method=card");
  assert.notEqual(changed, original);
  assert.equal(attempt.keyFor("job=12,amount=2000,tip=100,method=card"), changed);
  attempt.reset();
  assert.notEqual(attempt.keyFor("job=12,amount=2000,tip=100,method=card"), changed);
});
