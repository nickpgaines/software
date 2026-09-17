import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { fixture, invalidRequestError, loadTerminal, provider, setSession } from './helpers/terminal-harness.mjs';

const modules = await loadTerminal();
let database: ReturnType<typeof fixture>;
beforeEach(async () => { database = fixture(); await modules.schema.installTerminalSchema(database.db); });
afterEach(() => database.close());
const consent = { accepted: true, version: 'terminal-save-v1', customer_name: 'Ada Lovelace' };
const request = (body: object, key = 'terminal-123') => new Request('https://www.forgecrm.app/api/stripe/terminal/attempts', { method: 'POST', headers: { Origin: 'https://www.forgecrm.app', 'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const subscriptionRequest = (body: object) => new Request('https://www.forgecrm.app/api/customer-subscriptions', { method: 'POST', headers: { Origin: 'https://www.forgecrm.app', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const webhookRequest = () => new Request('https://www.forgecrm.app/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'valid' }, body: '{}' });
const start = (body: object = { operation: 'payment', job_id: 12, save_card: false }, key = 'terminal-123') => modules.route.POST(request(body, key));
const update = (id: string, cancel = false) => modules[cancel ? 'cancel' : 'reconcile'].POST(request({}), { params: { id } });

for (const amount of [25, 49, 100_000_000]) {
  test(`unsupported USD balance ${amount} is rejected without reserving the job`, async () => {
    database.sqlite.prepare('UPDATE jobs SET price_cents=? WHERE id=12').run(amount);
    assert.equal((await start()).status, 400);
    assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_attempts').get().n, 0);
    assert.equal(provider.creates.length, 0);
    database.sqlite.prepare('UPDATE jobs SET price_cents=22500 WHERE id=12').run();
    assert.equal((await (await start()).json()).status, 'ready');
  });
}
for (const amount of [50, 99_999_999]) {
  test(`supported USD boundary ${amount} can create an attempt`, async () => {
    database.sqlite.prepare('UPDATE jobs SET price_cents=? WHERE id=12').run(amount);
    const result = await (await start()).json();
    assert.equal(result.status, 'ready');
    assert.equal(result.amount_cents, amount);
  });
}
for (const code of ['amount_too_small', 'amount_too_large']) {
  test(`definitive ${code} rejection releases only its own reservation and recovers without lookup`, async () => {
    const setup = await (await start({ operation: 'setup', customer_id: 90, consent }, 'unrelated')).json();
    provider.createError = invalidRequestError({ code });
    const rejected = await (await start()).json();
    assert.equal(rejected.status, 'canceled');
    assert.ok(rejected.warning);
    assert.equal(rejected.client_secret, undefined);
    assert.equal(database.sqlite.prepare('SELECT provider_intent_id FROM terminal_attempts WHERE attempt_id=?').get(rejected.attempt_id).provider_intent_id, null);
    assert.equal(database.sqlite.prepare('SELECT status FROM terminal_attempts WHERE attempt_id=?').get(setup.attempt_id).status, 'ready');
    provider.failLookup = true;
    assert.equal((await (await start()).json()).status, 'canceled');
    assert.equal((await (await update(rejected.attempt_id)).json()).status, 'canceled');
    assert.equal((await (await update(rejected.attempt_id, true)).json()).status, 'canceled');
    provider.failLookup = false;
    provider.createError = null;
    assert.equal((await (await start(undefined, 'replacement')).json()).status, 'ready');
    assert.equal(provider.intents.length, 2);
  });
}
for (const [label, overrides] of [
  ['unknown validation', { code: 'parameter_invalid_empty' }],
  ['wrong parameter', { param: 'application_fee_amount' }],
  ['server failure', { statusCode: 500 }],
  ['existing payment intent', { payment_intent: { id: 'pi_existing' } }],
  ['existing setup intent', { setup_intent: { id: 'seti_existing' } }],
  ['existing charge', { charge: 'ch_existing' }],
] as const) {
  test(`${label} create error keeps the payment reservation unresolved`, async () => {
    provider.createError = invalidRequestError(overrides);
    const result = await (await start()).json();
    assert.equal(result.status, 'needs_reconciliation');
    assert.equal((await start(undefined, 'replacement')).status, 409);
    assert.equal((await (await update(result.attempt_id, true)).json()).status, 'needs_reconciliation');
    assert.equal(database.sqlite.prepare('SELECT status FROM terminal_attempts').get().status, 'needs_reconciliation');
  });
}
for (const succeeded of [false, true]) {
  test(`late validation rejection preserves concurrently recorded ${succeeded ? 'success' : 'provider identity'}`, async () => {
    provider.createError = invalidRequestError({});
    provider.beforeCreateError = () => database.sqlite.prepare(
      'UPDATE terminal_attempts SET provider_intent_id=?,status=?,payment_recorded=? WHERE idempotency_key=?',
    ).run('pi_concurrent', succeeded ? 'succeeded' : 'needs_reconciliation', succeeded ? 1 : 0, 'terminal-123');
    const result = await (await start()).json();
    assert.equal(result.status, succeeded ? 'succeeded' : 'needs_reconciliation');
    assert.equal(result.payment_recorded, succeeded);
    const row = database.sqlite.prepare('SELECT * FROM terminal_attempts').get();
    assert.equal(row.provider_intent_id, 'pi_concurrent');
    assert.equal(row.status, result.status);
  });
}

for (const operation of ['payment', 'setup'] as const) {
  for (const recovery of ['reconcile', 'replay', 'webhook'] as const) {
    test(`disabled charging permits ${operation} ${recovery} recovery and card saving`, async () => {
      const body = operation === 'payment'
        ? { operation, job_id: 12, save_card: true, consent }
        : { operation, customer_id: 90, consent };
      const created = await (await start(body)).json();
      provider.intents[0].status = 'succeeded';
      provider.intents[0][operation === 'payment' ? 'latest_charge' : 'latest_attempt'] = {
        payment_method_details: { card_present: { generated_card: 'pm_generated' } },
      };
      database.sqlite.prepare('UPDATE company SET stripe_charges_enabled=0 WHERE id=1').run();
      provider.event = { id: `evt_disabled_${operation}`, type: `${operation}_intent.succeeded`, account: 'acct_1', data: { object: provider.intents[0] } };
      const response = recovery === 'replay' ? await start(body)
        : recovery === 'webhook' ? await modules.webhook.POST(webhookRequest())
          : await update(created.attempt_id);
      assert.equal(response.status, 200);
      const row = database.sqlite.prepare('SELECT * FROM terminal_attempts').get();
      assert.equal(row.status, 'succeeded');
      assert.equal(row.card_saved, 1);
      assert.equal(row.payment_recorded, operation === 'payment' ? 1 : 0);
      assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, operation === 'payment' ? 1 : 0);
      assert.equal(database.sqlite.prepare('SELECT stripe_payment_method_id FROM stripe_payment_methods').get().stripe_payment_method_id, 'pm_generated');
      assert.equal(provider.creates.length, 1);
      assert.equal((await start(body, 'new-disabled-attempt')).status, 409);
      assert.equal(provider.creates.length, 1);
      assert.equal((await start({ operation: 'setup', customer_id: 90, consent: { ...consent, customer_name: 'Different name' } })).status, 409);
    });
  }
  test(`disabled charging permits canceling an existing ${operation}`, async () => {
    const body = operation === 'payment'
      ? { operation, job_id: 12, save_card: false }
      : { operation, customer_id: 90, consent };
    const created = await (await start(body)).json();
    database.sqlite.prepare('UPDATE company SET stripe_charges_enabled=0 WHERE id=1').run();
    const result = await update(created.attempt_id, true);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).status, 'canceled');
    assert.equal(provider.intents[0].status, 'canceled');
    assert.equal((await start(body, 'new-disabled-attempt')).status, 409);
    assert.equal(provider.creates.length, 1);
  });
}
test('disabled charging allows retrying card persistence after payment success', async () => {
  const body = { operation: 'payment', job_id: 12, save_card: true, consent };
  const created = await (await start(body)).json();
  provider.intents[0].status = 'succeeded';
  provider.intents[0].latest_charge = { payment_method_details: { card_present: { generated_card: 'pm_generated' } } };
  provider.failSave = true;
  assert.equal((await (await update(created.attempt_id)).json()).payment_recorded, true);
  assert.equal(database.sqlite.prepare('SELECT save_pending FROM terminal_attempts').get().save_pending, 1);
  database.sqlite.prepare('UPDATE company SET stripe_charges_enabled=0 WHERE id=1').run();
  provider.failSave = false;
  const response = await start(body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).card_saved, true);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 1);
  assert.equal(database.sqlite.prepare('SELECT save_pending FROM terminal_attempts').get().save_pending, 0);
});
test('disabled charging never relaxes tenant or account matching for existing recovery', async () => {
  const created = await (await start()).json();
  provider.intents[0].status = 'succeeded';
  database.sqlite.prepare('UPDATE company SET stripe_charges_enabled=0 WHERE id=1').run();
  setSession({ companyId: 2, staffId: 8 });
  assert.equal((await update(created.attempt_id)).status, 404);
  assert.equal((await update(created.attempt_id, true)).status, 404);
  setSession({ companyId: 1, staffId: 7 });
  database.sqlite.prepare("UPDATE company SET stripe_account_id='acct_changed' WHERE id=1").run();
  assert.equal((await update(created.attempt_id)).status, 409);
  assert.equal((await update(created.attempt_id, true)).status, 409);
  assert.equal((await start()).status, 409);
  provider.event = { id: 'evt_remapped', type: 'payment_intent.succeeded', account: 'acct_1', data: { object: provider.intents[0] } };
  assert.equal((await modules.webhook.POST(webhookRequest())).status, 500);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 0);
  assert.equal(provider.creates.length, 1);
});

test('schema upgrades existing cards and can be run twice', async () => {
  await modules.schema.installTerminalSchema(database.db);
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_payment_method_id) VALUES (1,1,90,'pm_old')").run();
  assert.equal(database.sqlite.prepare('SELECT requires_explicit_selection FROM stripe_payment_methods').get().requires_explicit_selection, 0);
});
test('canonical balance and durable concurrent claims allow exactly one provider intent', async () => {
  const responses = await Promise.all([start(), start(), start(undefined, 'different-key')]);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[2].status, 409);
  const first = await responses[0].json();
  assert.equal(first.amount_cents, 22500);
  assert.equal(provider.creates.length, 1);
  assert.equal(provider.creates[0].body.amount, 22500);
  assert.equal(provider.creates[0].body.application_fee_amount, 113);
  assert.equal(provider.creates[0].options.stripeAccount, 'acct_1');
  database.sqlite.prepare('UPDATE jobs SET price_cents=30000 WHERE id=12').run();
  assert.equal((await (await start()).json()).amount_cents, 22500);
  assert.equal((await start({ operation: 'payment', job_id: 12, save_card: true, consent })).status, 409);
});
test('payment and save failure remain distinct and redelivery deduplicates effects', async () => {
  const created = await (await start({ operation: 'payment', job_id: 12, save_card: true, consent })).json();
  provider.intents[0].status = 'succeeded';
  const result = await (await update(created.attempt_id)).json();
  assert.equal(result.status, 'succeeded'); assert.equal(result.payment_recorded, true);
  assert.equal(result.card_saved, false); assert.ok(result.warning);
  await update(created.attempt_id, true);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 1);
  assert.equal(provider.cancelCalls.length, 0); assert.equal(provider.updates.length, 0);
});
test('setup creates no payment and generated card is explicit-only with limited redisplay', async () => {
  const created = await (await start({ operation: 'setup', customer_id: 90, consent })).json();
  assert.equal(provider.creates[0].operation, 'setup');
  provider.intents[0].status = 'succeeded';
  provider.intents[0].latest_attempt = { payment_method_details: { card_present: { generated_card: 'pm_generated' } } };
  const result = await (await update(created.attempt_id)).json();
  assert.equal(result.card_saved, true); assert.equal(result.payment_recorded, false);
  const saved = database.sqlite.prepare('SELECT * FROM stripe_payment_methods').get();
  assert.equal(saved.requires_explicit_selection, 1); assert.equal(saved.is_default, 0); assert.equal(saved.allow_redisplay, 'limited');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 0);
  assert.equal(provider.updates.length, 0);
});
test('uncertain create recovers exact metadata without recreating after retention expiry', async () => {
  provider.failCreate = true; provider.visible = false;
  const created = await (await start()).json();
  assert.equal(created.status, 'needs_reconciliation');
  database.sqlite.prepare("UPDATE terminal_attempts SET created_at='2020-01-01'").run();
  assert.equal((await (await start()).json()).status, 'needs_reconciliation');
  assert.equal(provider.creates.length, 1);
  provider.visible = true;
  assert.equal((await (await update(created.attempt_id)).json()).status, 'ready');
  assert.equal(provider.creates.length, 1);
});
test('consent, safe IDs, ownership, same origin and account remapping fail closed', async () => {
  for (const body of [{ operation: 'setup', customer_id: 90 }, { operation: 'payment', job_id: 0, save_card: false }, { operation: 'payment', job_id: 1.2, save_card: false }]) assert.equal((await start(body)).status, 400);
  assert.equal((await start({ operation: 'payment', job_id: 22, save_card: false })).status, 404);
  const cross = request({}); cross.headers.set('Origin','https://evil.example'); assert.equal((await modules.route.POST(cross)).status, 403);
  const created = await (await start()).json();
  setSession({ companyId: 2, staffId: 8 }); assert.equal((await update(created.attempt_id)).status, 404);
  setSession({ companyId: 1, staffId: 7 }); database.sqlite.prepare("UPDATE company SET stripe_account_id='acct_changed' WHERE id=1").run();
  assert.equal((await update(created.attempt_id)).status, 409);
});
test('wrong job metadata never records a succeeded payment', async () => {
  const created = await (await start()).json(); provider.intents[0].status = 'succeeded'; provider.intents[0].metadata.job_id = '13';
  assert.equal((await update(created.attempt_id)).status, 409);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 0);
});
test('connection token requires exact authenticated account', async () => {
  const req = request({}); req.headers.set('X-Forge-Stripe-Account', 'acct_other');
  assert.equal((await modules.token.POST(req)).status, 409); assert.equal(provider.tokens.length, 0);
  req.headers.set('X-Forge-Stripe-Account', 'acct_1'); assert.equal((await modules.token.POST(req)).status, 200);
});
test('webhook card-provider failure retries after payment is recorded', async () => {
  await start({ operation: 'payment', job_id: 12, save_card: true, consent });
  provider.intents[0].status='succeeded'; provider.intents[0].latest_charge={ payment_method_details: { card_present: { generated_card: 'pm_generated' } } };
  provider.failSave = true;
  provider.event = { id: 'evt_terminal', type: 'payment_intent.succeeded', account: 'acct_1', data: { object: provider.intents[0] } };
  const webhook = () => modules.webhook.POST(new Request('https://www.forgecrm.app/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'valid' }, body: '{}' }));
  assert.equal((await webhook()).status, 500);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 1);
  provider.failSave = false; assert.equal((await webhook()).status, 200); assert.equal((await webhook()).status, 200);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n, 1);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM stripe_payment_methods').get().n, 1);
});
test('explicit subscription selection changes only accepted customer-owned subscription reference', async () => {
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,exp_month,exp_year,requires_explicit_selection) VALUES (7,1,90,'cus_test','pm_selected',12,2099,1)").run();
  const select = () => modules.selection.PUT(request({ payment_method_id: 7 }), { params: { id: '1' } });
  assert.equal((await select()).status, 200);
  assert.equal(database.sqlite.prepare('SELECT default_payment_method_id FROM customer_subscriptions').get().default_payment_method_id, 'pm_selected');
  assert.equal(provider.creates.length, 0);
  database.sqlite.prepare('UPDATE customer_subscriptions SET accepted_at=NULL').run(); assert.equal((await select()).status, 409);
  database.sqlite.prepare("UPDATE customer_subscriptions SET accepted_at='2026-09-01', customer_id=99").run(); assert.equal((await select()).status, 404);
});
test('missing configured real location fails before claiming a job', async () => {
  provider.locationInvalid=true;
  assert.equal((await start()).status,409);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_attempts').get().n,0);
  provider.locationInvalid=false; assert.equal((await start()).status,200);
});
test('list contains recoverable attempts without secrets and cancellation releases job', async () => {
  const created = await (await start()).json();
  const response = await modules.route.GET(new Request('https://www.forgecrm.app/api/stripe/terminal/attempts?job_id=12'));
  const list = await response.json(); assert.equal(list.attempts.length,1); assert.equal(list.attempts[0].client_secret,undefined);
  assert.equal((await (await update(created.attempt_id,true)).json()).status,'canceled');
  assert.equal((await start(undefined,'next-attempt')).status,200);
});
test('unresolved Terminal blocks alternate new card charges while preserving its recovery', async () => {
  const created = await (await start()).json();
  for (const name of ['charge','cardIntent','legacyTerminal'] as const) {
    assert.equal((await modules[name].POST(request({ amount_cents: 22500 }),{ params: { id:'12' } })).status,409,name);
  }
  assert.equal(provider.creates.length,1);
  assert.equal((await update(created.attempt_id)).status,200);
});
test('Terminal generated wallet cards stay recurring-only across ordinary resave and default actions', async () => {
  const created = await (await start({ operation:'setup',customer_id:90,consent })).json();
  provider.wallet={ type:'apple_pay' }; provider.intents[0].status='succeeded';
  provider.intents[0].latest_attempt={ payment_method_details:{ card_present:{ generated_card:'pm_wallet' } } };
  await update(created.attempt_id);
  const saved = database.sqlite.prepare('SELECT * FROM stripe_payment_methods').get();
  assert.equal(saved.recurring_only,1);
  assert.equal((await modules.charge.POST(request({ amount_cents:22500,payment_method_id:saved.id }),{ params:{ id:'12' } })).status,409);
  assert.equal((await modules.defaults.PATCH(request({ is_default:true }),{ params:{ id:String(saved.id) } })).status,409);
  await modules.stripe.savePaymentMethodForCustomer({ companyId:1,customerId:90,stripeAccountId:'acct_1',stripePaymentMethodId:'pm_wallet',makeDefault:true });
  assert.equal(database.sqlite.prepare('SELECT is_default FROM stripe_payment_methods').get().is_default,0);
  assert.equal(provider.updates.length,0);
});
test('subscription creation and job charging never implicitly fall back to an explicit-only card', async () => {
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,requires_explicit_selection) VALUES (7,1,90,'cus_test','pm_selected',1)").run();
  assert.equal((await modules.charge.POST(request({ amount_cents:22500 }),{ params:{id:'12'} })).status,400);
  const result = await modules.stripeSubscriptions.createStripeSubscriptionForRow({ companyId:1,customerId:90,subscriptionRowId:1,productName:'Membership',amountCents:1000,interval:'monthly' });
  assert.deepEqual(result,{ok:false,error:'no_card'});
});
test('activation with explicit card preserves required acceptance without charging', async () => {
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,exp_month,exp_year,requires_explicit_selection) VALUES (7,1,90,'cus_test','pm_selected',12,2099,1)").run();
  database.sqlite.prepare('UPDATE customer_subscriptions SET accepted_at=NULL').run();
  assert.equal((await modules.activate.POST(request({ payment_method_id:7 }),{ params:{id:'1'} })).status,409);
  database.sqlite.prepare("UPDATE customer_subscriptions SET accepted_at='2026-09-01'").run();
  assert.equal((await modules.activate.POST(request({ payment_method_id:7 }),{ params:{id:'1'} })).status,200);
  assert.equal(database.sqlite.prepare('SELECT default_payment_method_id FROM customer_subscriptions').get().default_payment_method_id,'pm_selected');
  assert.equal(provider.creates.length,0);
});
test('consent snapshot retains merchant and exact versioned text across recovery', async () => {
  const created=await (await start({operation:'setup',customer_id:90,consent})).json();
  const row=database.sqlite.prepare('SELECT * FROM terminal_attempts').get();
  assert.ok(row.consent_text); assert.ok(row.consent_merchant); assert.equal(row.consent_staff_id,7);
  database.sqlite.prepare("UPDATE company SET name='Renamed Merchant' WHERE id=1").run();
  await update(created.attempt_id);
  assert.equal(database.sqlite.prepare('SELECT consent_text FROM terminal_attempts').get().consent_text,row.consent_text);
});
test('successful local outcome cannot regress from a stale provider response', async () => {
  const created=await (await start()).json(); provider.intents[0].status='succeeded'; await update(created.attempt_id);
  provider.intents[0].status='requires_payment_method';
  const result=await (await update(created.attempt_id)).json();
  assert.equal(result.status,'succeeded'); assert.equal(result.client_secret,undefined); assert.equal(result.payment_recorded,true);
});
test('database write failure makes webhook retryable, including duplicate delivery', async () => {
  await start(); provider.intents[0].status='succeeded';
  provider.event={ id:'evt_db',type:'payment_intent.succeeded',account:'acct_1',data:{object:provider.intents[0]} };
  database.sqlite.exec("CREATE TRIGGER block_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT,'disk unavailable'); END;");
  const deliver=()=>modules.webhook.POST(new Request('https://www.forgecrm.app/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'valid'},body:'{}'}));
  assert.equal((await deliver()).status,500);
  database.sqlite.exec('DROP TRIGGER block_payment'); assert.equal((await deliver()).status,200); assert.equal((await deliver()).status,200);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
});
test('unauthenticated requests and unsigned subscription selection are rejected', async () => {
  setSession(null); assert.equal((await start()).status,401);
  setSession({companyId:1,staffId:7}); database.sqlite.prepare('UPDATE customer_subscriptions SET require_signature=1,signature_data=NULL').run();
  assert.equal((await modules.selection.PUT(request({payment_method_id:7}),{params:{id:'1'}})).status,409);
});
test('automatic billing excludes Terminal fallback and wallet manual amount overrides', async () => {
  database.sqlite.exec('CREATE TABLE subscription_charge_attempts (id INTEGER,subscription_id INTEGER,period_key TEXT,status TEXT)');
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,requires_explicit_selection,recurring_only) VALUES (7,1,90,'cus_test','pm_wallet',1,1)").run();
  const sub={id:1,company_id:1,customer_id:90,status:'active',accepted_at:'2026-09-01',require_signature:0,default_payment_method_id:null,interval:'monthly',price_cents:1000} as any;
  assert.deepEqual(await modules.billing.chargeSubscription(database.db,sub),{ok:false,status:'no_card'});
  const selected={...sub,default_payment_method_id:'pm_wallet'};
  const result=await modules.billing.chargeSubscription(database.db,selected,{amountCentsOverride:5000});
  assert.deepEqual(result,{ok:true,status:'skipped',reason:'recurring_card_requires_agreed_schedule'});
  assert.equal(provider.creates.length,0);
});
test('ordinary saving cannot promote a provider-identified generated card before Terminal reconciliation', async () => {
  provider.wallet={type:'apple_pay'};
  await modules.stripe.savePaymentMethodForCustomer({companyId:1,customerId:90,stripeAccountId:'acct_1',stripePaymentMethodId:'pm_wallet',makeDefault:true});
  const saved=database.sqlite.prepare('SELECT * FROM stripe_payment_methods').get();
  assert.equal(saved.is_default,0); assert.equal(saved.requires_explicit_selection,1); assert.equal(saved.recurring_only,1);
  assert.equal(provider.updates.length,0);
});

test('accepted subscription creation rejects a missing required signature before persistence', async () => {
  const response = await modules.subscriptions.POST(subscriptionRequest({
    customer_id: 90,
    template_id: 41,
    action: 'accept',
    price_cents: 1000,
    interval: 'monthly',
    payment_method_id: 7,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'signature is required for this subscription' });
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM customer_subscriptions').get().n, 1);
  assert.equal(provider.subscriptionCreates.length, 0);
});

test('signed subscription creation forwards the selected card without changing customer defaults', async () => {
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,exp_month,exp_year,is_default,requires_explicit_selection,stripe_account_id) VALUES (6,1,90,'cus_test','pm_default',12,2099,1,0,'acct_1'),(7,1,90,'cus_test','pm_selected',12,2099,0,1,'acct_1')").run();

  const response = await modules.subscriptions.POST(subscriptionRequest({
    customer_id: 90,
    template_id: 41,
    action: 'accept',
    price_cents: 1000,
    interval: 'monthly',
    signature_data: 'data:image/png;base64,signed',
    signature_name: 'Ada Lovelace',
    start_date: '2099-01-01',
    payment_method_id: 7,
  }));

  assert.equal(response.status, 201);
  assert.equal(provider.subscriptionCreates.length, 1);
  assert.equal(provider.subscriptionCreates[0].body.default_payment_method, 'pm_selected');
  assert.equal(provider.subscriptionCreates[0].options.stripeAccount, 'acct_1');
  assert.deepEqual(database.sqlite.prepare('SELECT stripe_payment_method_id,is_default FROM stripe_payment_methods ORDER BY id').all().map((row: Record<string, unknown>) => ({ ...row })), [
    { stripe_payment_method_id: 'pm_default', is_default: 1 },
    { stripe_payment_method_id: 'pm_selected', is_default: 0 },
  ]);
  const created = database.sqlite.prepare('SELECT * FROM customer_subscriptions WHERE id<>1').get();
  assert.equal(created.default_payment_method_id, 'pm_selected');
  assert.equal(created.status, 'active');
  assert.equal(created.signature_name, 'Ada Lovelace');
  assert.equal(provider.updates.length, 0);
});

test('ordinary SetupIntent webhook saves its payment method through the ordinary path', async () => {
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,exp_month,exp_year,is_default,requires_explicit_selection,stripe_account_id) VALUES (6,1,90,'cus_test','pm_default',12,2099,1,0,'acct_1')").run();
  provider.event = { id: 'evt_setup_ordinary', type: 'setup_intent.succeeded', account: 'acct_1', data: { object: {
    id: 'seti_ordinary', status: 'succeeded', payment_method: 'pm_ordinary', metadata: { company_id: '1', customer_id: '90' },
  } } };

  assert.equal((await modules.webhook.POST(webhookRequest())).status, 200);
  const saved = database.sqlite.prepare("SELECT * FROM stripe_payment_methods WHERE stripe_payment_method_id='pm_ordinary'").get();
  assert.equal(saved.requires_explicit_selection, 0);
  assert.equal(saved.is_default, 0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_attempts').get().n, 0);
});

test('ordinary SetupIntent webhook retries payment-method persistence failures', async () => {
  database.sqlite.prepare("INSERT INTO stripe_payment_methods (id,company_id,customer_id,stripe_customer_id,stripe_payment_method_id,exp_month,exp_year,is_default,requires_explicit_selection,stripe_account_id) VALUES (6,1,90,'cus_test','pm_default',12,2099,1,0,'acct_1')").run();
  provider.event = { id: 'evt_setup_retry', type: 'setup_intent.succeeded', account: 'acct_1', data: { object: {
    id: 'seti_retry', status: 'succeeded', payment_method: 'pm_ordinary', metadata: { company_id: '1', customer_id: '90' },
  } } };
  provider.failSave = true;

  assert.equal((await modules.webhook.POST(webhookRequest())).status, 500);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) n FROM stripe_payment_methods WHERE stripe_payment_method_id='pm_ordinary'").get().n, 0);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) n FROM stripe_webhook_events WHERE event_id='evt_setup_retry'").get().n, 0);
  provider.failSave = false;
  assert.equal((await modules.webhook.POST(webhookRequest())).status, 200);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) n FROM stripe_payment_methods WHERE stripe_payment_method_id='pm_ordinary'").get().n, 1);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) n FROM stripe_webhook_events WHERE event_id='evt_setup_retry'").get().n, 1);
  assert.equal(database.sqlite.prepare("SELECT is_default FROM stripe_payment_methods WHERE stripe_payment_method_id='pm_default'").get().is_default, 1);
  assert.equal(database.sqlite.prepare("SELECT is_default FROM stripe_payment_methods WHERE stripe_payment_method_id='pm_ordinary'").get().is_default, 0);
});

test('Terminal SetupIntent webhook saves only the generated card and retries failure', async () => {
  await start({ operation: 'setup', customer_id: 90, consent });
  provider.intents[0].status = 'succeeded';
  provider.intents[0].payment_method = 'pm_card_present';
  provider.intents[0].latest_attempt = { payment_method_details: { card_present: { generated_card: 'pm_generated' } } };
  provider.event = { id: 'evt_setup_terminal', type: 'setup_intent.succeeded', account: 'acct_1', data: { object: provider.intents[0] } };
  provider.failSave = true;

  assert.equal((await modules.webhook.POST(webhookRequest())).status, 500);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM stripe_payment_methods').get().n, 0);
  provider.failSave = false;
  assert.equal((await modules.webhook.POST(webhookRequest())).status, 200);
  const saved = database.sqlite.prepare('SELECT * FROM stripe_payment_methods').get();
  assert.equal(saved.stripe_payment_method_id, 'pm_generated');
  assert.equal(saved.requires_explicit_selection, 1);
  assert.equal(saved.is_default, 0);
  assert.equal(database.sqlite.prepare("SELECT COUNT(*) n FROM stripe_payment_methods WHERE stripe_payment_method_id='pm_card_present'").get().n, 0);
});
