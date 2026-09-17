import { registerHooks } from 'node:module';
import { paymentDatabase } from './payment-harness.mjs';
export { getDb, sendPaymentReceipt, recordActivity, autoCompleteSteps, preparePaymentCompletionNotification, dispatchPaymentCompletionNotification } from './payment-harness.mjs';
export let session = { companyId: 1, staffId: 7 };
export const setSession = value => { session = value; };
export const getSessionContext = async () => session;
export const requireCompanyId = async () => session.companyId;
/** @type {{ intents: any[], creates: any[], updates: any[], tokens: any[], cancelCalls: any[], failCreate: boolean, failSave: boolean, visible: boolean, event: any, wallet: any, locationInvalid: boolean }} */
export const provider = { intents: [], creates: [], updates: [], tokens: [], cancelCalls: [], failCreate: false, failSave: false, visible: true, event: null, wallet: null, locationInvalid: false };
export default class Stripe {
  constructor() {
    const resource = operation => ({
      create: async (body, options) => {
        provider.creates.push({ operation, body, options });
        const intent = { id: `${operation === 'payment' ? 'pi' : 'seti'}_${provider.intents.length + 1}`, ...body, amount_received: body.amount, client_secret: 'secret', status: 'requires_payment_method' };
        provider.intents.push(intent);
        if (provider.failCreate) throw new Error('connection lost');
        return intent;
      },
      retrieve: async id => { const intent = provider.intents.find(i => i.id === id); if (!intent) throw new Error('missing intent'); return intent; },
      search: async () => ({ data: provider.visible ? provider.intents : [], has_more: false }),
      list: async () => ({ data: provider.visible ? provider.intents : [], has_more: false }),
      cancel: async id => { provider.cancelCalls.push(id); const intent = provider.intents.find(i => i.id === id); intent.status = 'canceled'; return intent; },
    });
    return {
      paymentIntents: resource('payment'), setupIntents: resource('setup'),
      customers: { create: async () => ({ id: 'cus_test' }), update: async (...args) => { provider.updates.push(args); } },
      paymentMethods: { retrieve: async id => {
        if (provider.failSave) throw new Error('provider unavailable');
        return { id, type: 'card', customer: 'cus_test', allow_redisplay: 'limited', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2099, wallet: provider.wallet, generated_from: id === 'pm_wallet' ? { charge:'ch_terminal',payment_method_details:{card_present:{wallet:provider.wallet}} } : null } };
      } },
      subscriptions: { update: async (...args) => { provider.updates.push(args); return {}; }, retrieve: async () => ({ customer: 'cus_test' }) },
      terminal: { connectionTokens: { create: async (body, opts) => { provider.tokens.push(opts); return { secret: 'token' }; } }, locations: {
        retrieve: async id => ({ id, address: { country: 'US', line1: '123 Main', city: 'Chicago', state: 'IL', postal_code: provider.locationInvalid ? '00000' : '60601' } }),
        list: async () => ({ data: [], has_more: false }),
      } },
      webhooks: { constructEvent: () => provider.event },
    };
  }
}
export function fixture() {
  const db = paymentDatabase();
  db.sqlite.exec(`
    UPDATE jobs SET price_cents=22500 WHERE id=12;
    DROP TABLE terminal_attempts;
    ALTER TABLE company ADD COLUMN stripe_account_id TEXT;
    ALTER TABLE company ADD COLUMN stripe_charges_enabled INTEGER;
    UPDATE company SET stripe_account_id='acct_' || id, stripe_charges_enabled=1;
    CREATE TABLE stripe_customers (company_id INTEGER, customer_id INTEGER, stripe_customer_id TEXT);
    INSERT INTO stripe_customers VALUES (1,90,'cus_test');
    DROP TABLE stripe_payment_methods;
    CREATE TABLE stripe_payment_methods (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER, stripe_customer_id TEXT, stripe_payment_method_id TEXT, brand TEXT, last4 TEXT, exp_month INTEGER, exp_year INTEGER, wallet_type TEXT, is_default INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(company_id,stripe_payment_method_id));
    CREATE TABLE stripe_terminal_locations (company_id INTEGER UNIQUE, stripe_terminal_location_id TEXT, display_name TEXT);
    INSERT INTO stripe_terminal_locations VALUES (1,'tml_test','Merchant');
    CREATE TABLE stripe_webhook_events (event_id TEXT PRIMARY KEY, type TEXT);
    CREATE TABLE customer_subscriptions (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER, status TEXT, accepted_at TEXT, require_signature INTEGER DEFAULT 0, signature_data TEXT, default_payment_method_id TEXT, stripe_subscription_id TEXT);
    INSERT INTO customer_subscriptions VALUES (1,1,90,'active','2026-09-01',0,NULL,NULL,'sub_test');
  `);
  for (const key of ['intents','creates','updates','tokens','cancelCalls']) provider[key] = [];
  Object.assign(provider, { failCreate: false, failSave: false, visible: true, event: null, wallet: null, locationInvalid: false });
  session = { companyId: 1, staffId: 7 };
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  return db;
}
export async function loadTerminal() {
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
    if (specifier === 'stripe' || /^(?:@\/lib\/|\.\/)(?:db|auth|payment-receipts|activity|payment-job-completion)(?:\.ts)?$/.test(specifier)) return { url: import.meta.url, shortCircuit: true };
    if (specifier === 'next/server') return next('next/server.js', context);
    if (specifier.startsWith('@/')) return next(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier.startsWith('./') && !specifier.endsWith('.ts') && context.parentURL?.includes('/src/lib/')) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  } });
  try {
    return {
      service: await import('../../src/lib/terminal-attempts.ts'),
      schema: await import('../../src/lib/terminal-schema.ts'),
      route: await import('../../src/app/api/stripe/terminal/attempts/route.ts'),
      reconcile: await import('../../src/app/api/stripe/terminal/attempts/[id]/reconcile/route.ts'),
      cancel: await import('../../src/app/api/stripe/terminal/attempts/[id]/cancel/route.ts'),
      token: await import('../../src/app/api/stripe/terminal/connection-token/route.ts'),
      webhook: await import('../../src/app/api/stripe/webhook/route.ts'),
      selection: await import('../../src/app/api/customer-subscriptions/[id]/payment-method/route.ts'),
      stripe: await import('../../src/lib/stripe.ts'),
      stripeSubscriptions: await import('../../src/lib/stripe-subscriptions.ts'),
      billing: await import('../../src/lib/subscription-billing.ts'),
      charge: await import('../../src/app/api/jobs/[id]/payments/charge-saved-card/route.ts'),
      cardIntent: await import('../../src/app/api/jobs/[id]/payments/stripe-intent/route.ts'),
      legacyTerminal: await import('../../src/app/api/jobs/[id]/payments/terminal-intent/route.ts'),
      defaults: await import('../../src/app/api/stripe/payment-methods/[id]/route.ts'),
      activate: await import('../../src/app/api/customer-subscriptions/[id]/activate/route.ts'),
    };
  } finally { hooks.deregister(); }
}
