import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
export { autoCompleteSteps, preparePaymentCompletionNotification } from "../../src/lib/payment-job-completion.ts";
import { installLifecycleSchema } from "./lifecycle-harness.mjs";

let database;
let companyId = 1;
let beforeCreateReturn = async () => {};
let createProviderIntent = null;
let providerHistory = [];
let reconciliationVisible = true;
export function setReconciliationVisible(value) { reconciliationVisible = value; }
export function setBeforeCreateReturn(value) { beforeCreateReturn = value; }

// Models Stripe's per-account key cache: distinct keys can create distinct
// charges, while changed parameters for one key fail before another charge.
export function useIdempotentProvider() {
  const cached = new Map();
  const intents = [];
  createProviderIntent = (body, options) => {
    const key = `${options.stripeAccount}:${options.idempotencyKey}`;
    const parameters = JSON.stringify(body);
    const previous = cached.get(key);
    if (previous) {
      if (previous.parameters !== parameters) {
        throw Object.assign(new Error("Parameters differ for the existing idempotency key"), { type: "StripeIdempotencyError" });
      }
      return previous.intent;
    }
    const intent = { id: `pi_provider_${intents.length + 1}`, status: "succeeded", amount: body.amount, amount_received: body.amount, metadata: body.metadata, client_secret: "secret" };
    cached.set(key, { parameters, intent });
    intents.push(intent);
    return intent;
  };
  return { intents, expireKeys: () => cached.clear() };
}
/** @type {{ receipts: any[], completions: any[], activities: any[], creates: { body: any, options: any }[] }} */
export const effects = { receipts: [], completions: [], activities: [], creates: [] };
export let receiptError = false;
export let providerIntent = { id: "pi_test", status: "succeeded", amount: 1100, amount_received: 1100, metadata: { job_id: "12", amount_cents: "1000", tip_cents: "100" } };
export function setProviderIntent(value) { providerIntent = value; }
export function setCompanyId(value) { companyId = value; }
export function setReceiptError(value) { receiptError = value; }
export async function getSessionContext() { return { companyId, staffId: 7 }; }
export async function requireCompanyId() { return companyId; }
export function isStripeConfigured() { return true; }
export async function getCompany() { return { stripe_account_id: `acct_${companyId}`, stripe_charges_enabled: 1 }; }
export async function getOrCreateTerminalLocation() { return { stripe_terminal_location_id: "tml_test" }; }
export function getStripe() {
  return { paymentIntents: {
    retrieve: async (id, _params, options) => providerHistory.find(entry => entry.intent.id === id && entry.account === options?.stripeAccount)?.intent ?? providerIntent,
    search: async (params, options) => ({ data: reconciliationVisible
      ? providerHistory.filter(entry => entry.account === options.stripeAccount &&
        params.query === `metadata['saved_card_attempt_id']:'${entry.intent.metadata.saved_card_attempt_id}'`).map(entry => entry.intent)
      : [], has_more: false }),
    create: async (body, options) => {
      effects.creates.push({ body, options });
      providerIntent = createProviderIntent
        ? createProviderIntent(body, options)
        : { ...providerIntent, metadata: body.metadata };
      const created = { ...providerIntent, client_secret: "secret" };
      if (!providerHistory.some(entry => entry.intent.id === created.id && entry.account === options.stripeAccount)) {
        providerHistory.push({ intent: created, account: options.stripeAccount });
      }
      await beforeCreateReturn();
      return created;
    },
  } };
}
export async function sendPaymentReceipt(value) {
  effects.receipts.push(value);
  if (receiptError) throw new Error("receipt provider unavailable");
}
export async function recordActivity(...value) { effects.activities.push(value); }
export async function dispatchPaymentCompletionNotification(value) {
  effects.completions.push(value);
  return value.changed ? { attempted: true, ok: true, error: null } : null;
}
export async function getDb() { return database; }

/** @returns {Promise<import("../../src/lib/db.ts").Db>} */
export async function loadRealPaymentDb(suffix = "") {
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  } });
  try { return await (await import(`../../src/lib/db.ts${suffix}`)).getDb(); }
  finally { hooks.deregister(); }
}

export async function loadPaymentRoutes() {
  const overrides = new Set(["db", "auth", "stripe", "payment-receipts", "activity", "payment-job-completion"]);
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/lib/") && overrides.has(specifier.slice(6))) {
      return { url: import.meta.url, shortCircuit: true };
    }
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  } });
  try {
    const base = "../../src/app/api/jobs/[id]/payments/";
    return Object.fromEntries(await Promise.all(["manual", "stripe-confirm", "charge-saved-card", "stripe-intent", "terminal-intent"].map(async name => [name, (await import(`${base}${name === "manual" ? "" : `${name}/`}route.ts`)).POST])));
  } finally { hooks.deregister(); }
}

export function paymentDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, first_name TEXT, last_name TEXT, email TEXT, company_id INTEGER);
    INSERT INTO customers VALUES (90, 'Ada', 'Ada', 'Lovelace', 'ada@example.com', 1);
    CREATE TABLE jobs (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER, price_cents INTEGER, scheduled_at TEXT DEFAULT '2026-08-24T15:00:00.000Z', status TEXT DEFAULT 'scheduled', completed_at TEXT, started_at TEXT, arrived_at TEXT, en_route_at TEXT);
    INSERT INTO jobs (id, company_id, customer_id, price_cents) VALUES (12,1,90,5000), (13,1,90,5000), (22,2,90,5000);
    CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, job_id INTEGER, amount_cents INTEGER, tip_cents INTEGER DEFAULT 0, method TEXT, payment_date TEXT, notes TEXT, send_email INTEGER DEFAULT 0, send_sms INTEGER DEFAULT 0, stripe_payment_intent_id TEXT, subscription_id INTEGER, source TEXT DEFAULT 'job', created_at TEXT DEFAULT (datetime('now')), idempotency_key TEXT, request_fingerprint TEXT);
    CREATE UNIQUE INDEX idx_payments_idempotency ON payments(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE TABLE saved_card_payment_attempts (
      company_id INTEGER NOT NULL, idempotency_key TEXT NOT NULL,
      attempt_id TEXT NOT NULL UNIQUE, request_fingerprint TEXT NOT NULL,
      stripe_account_id TEXT NOT NULL, stripe_payment_intent_id TEXT, payment_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (company_id, idempotency_key)
    );
    CREATE TABLE stripe_payment_methods (id INTEGER, company_id INTEGER, customer_id INTEGER, stripe_customer_id TEXT, stripe_payment_method_id TEXT, is_default INTEGER, created_at TEXT);
    INSERT INTO stripe_payment_methods VALUES (5,1,90,'cus_test','pm_test',1,'2026-09-11');
  `);
  installLifecycleSchema(sqlite);
  sqlite.exec("INSERT INTO estimates VALUES (1,90,1)");
  let pending = Promise.resolve();
  let stalePaymentReads = false;
  function prepare(sql, authoritative = false) {
    const stmt = sqlite.prepare(sql);
    return {
      get: async (...args) => stalePaymentReads && !authoritative && /SELECT \* FROM payments WHERE company_id = \? AND idempotency_key = \?/.test(sql)
        ? undefined : stmt.get(...args),
      all: async (...args) => stmt.all(...args),
      run: async (...args) => { const result = stmt.run(...args); return { lastInsertRowid: Number(result.lastInsertRowid), changes: Number(result.changes) }; },
    };
  }
  database = {
    prepare,
    exec: async (sql) => sqlite.exec(sql),
    transaction(fn) {
      const result = pending.then(async () => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const tx = { ...database, prepare: sql => prepare(sql, true), transaction: async nested => nested(tx) };
          const result = await fn(tx);
          sqlite.exec("COMMIT");
          return result;
        }
        catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      });
      pending = result.catch(() => {});
      return result;
    },
  };
  companyId = 1;
  receiptError = false;
  beforeCreateReturn = async () => {};
  createProviderIntent = null;
  providerHistory = [];
  reconciliationVisible = true;
  providerIntent = { id: "pi_test", status: "succeeded", amount: 1100, amount_received: 1100, metadata: { job_id: "12", amount_cents: "1000", tip_cents: "100" } };
  for (const list of Object.values(effects)) list.length = 0;
  return { sqlite, db: database, setStalePaymentReads: value => { stalePaymentReads = value; }, close: () => sqlite.close() };
}
