import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, loadBilling, provider, paidSubscription } from './helpers/forge-billing-harness.mjs';

const { service, access, schema, routes } = await loadBilling();

test('legacy company trials use each earliest employee date and expire at exactly 14 days', async () => {
  const db = fixture();
  await db.prepare("UPDATE staff SET created_at='2026-09-20 18:30:00' WHERE company_id=2").run();
  await schema.installForgeBillingSchema(db);
  process.env.FORGE_BILLING_CUTOFF_AT = '2099-01-01T00:00:00Z';
  const before = await service.getCompanyBillingStatus(1, new Date('2026-09-15T11:59:59.999Z'));
  assert.equal(before.allowed, true);
  assert.equal(before.reason, 'trial');
  assert.equal(before.trialEndsAt, '2026-09-15T12:00:00.000Z');
  const at = await access.getCompanyBillingAccess(1, new Date('2026-09-15T12:00:00Z'));
  assert.deepEqual(at, { allowed: false, reason: 'subscription_required' });
  const newer = await service.getCompanyBillingStatus(2, new Date('2026-09-30T00:00:00Z'));
  assert.equal(newer.allowed, true);
  assert.equal(newer.trialEndsAt, '2026-10-04T18:30:00.000Z');
  assert.equal(provider.calls.length, 0);
});

test('deleting the first employee, adding employees, reinstalling or toggling billing cannot restart a trial', async () => {
  const db = fixture();
  await schema.installForgeBillingSchema(db);
  await db.prepare("INSERT INTO staff VALUES(9,1,'admin',NULL,'2026-09-20 18:30:00')").run();
  await db.prepare('DELETE FROM staff WHERE id=7').run();
  process.env.FORGE_BILLING_ENABLED = 'false';
  await schema.installForgeBillingSchema(db);
  assert.equal((await service.getCompanyBillingStatus(1, new Date('2026-09-21'))).allowed, true);
  process.env.FORGE_BILLING_ENABLED = 'true';
  const status = await service.getCompanyBillingStatus(1, new Date('2026-09-21'));
  assert.equal(status.allowed, false);
  assert.equal(status.trialEndsAt, '2026-09-15T12:00:00.000Z');
});

test('future companies record signup even while disabled before any employee exists', async () => {
  const db = fixture();
  process.env.FORGE_BILLING_ENABLED = 'false';
  await schema.installForgeBillingSchema(db);
  const before = Date.now();
  await db.prepare('INSERT INTO company VALUES(3)').run();
  const stored = await db.prepare('SELECT started_at,source FROM forge_billing_trials WHERE company_id=3').get();
  assert.equal(stored.source, 'signup');
  const started = Date.parse(stored.started_at);
  assert.ok(started >= before - 1000 && started <= Date.now());
  await db.prepare("INSERT INTO staff VALUES(10,3,'admin',NULL,'2099-01-01 00:00:00')").run();
  await schema.installForgeBillingSchema(db);
  process.env.FORGE_BILLING_ENABLED = 'true';
  assert.equal((await service.getCompanyBillingStatus(3, new Date(started + 14 * 86400000 - 1))).reason, 'trial');
  assert.equal((await service.getCompanyBillingStatus(3, new Date(started + 14 * 86400000))).allowed, false);
  assert.equal((await db.prepare('SELECT started_at FROM forge_billing_trials WHERE company_id=3').get()).started_at, stored.started_at);
});

test('signup timestamp and trial roll back together with a failed signup transaction', async () => {
  const db = fixture();
  await schema.installForgeBillingSchema(db);
  await assert.rejects(db.transaction(async tx => {
    await tx.prepare('INSERT INTO company VALUES(3)').run();
    throw new Error('signup failed');
  }), /signup failed/);
  assert.equal(await db.prepare('SELECT * FROM forge_billing_trials WHERE company_id=3').get(), undefined);
});

test('trial lasts 336 hours across daylight saving changes, interpreting legacy SQL dates as UTC', async () => {
  const db = fixture();
  await db.prepare("UPDATE staff SET created_at='2026-10-25 12:00:00' WHERE company_id=1").run();
  await schema.installForgeBillingSchema(db);
  const status = await service.getCompanyBillingStatus(1, new Date('2026-11-08T11:59:59Z'));
  assert.equal(status.trialEndsAt, '2026-11-08T12:00:00.000Z');
  assert.equal(status.allowed, true);
  assert.equal((await service.getCompanyBillingStatus(1, new Date('2026-11-08T12:00:00Z'))).allowed, false);
});

test('missing legacy dates never get a fresh trial and paid entitlement still works', async () => {
  const db = fixture();
  await db.prepare('DELETE FROM staff WHERE company_id=1').run();
  await schema.installForgeBillingSchema(db);
  await assert.rejects(service.getCompanyBillingStatus(1), { status: 503 });
  await db.prepare("INSERT INTO staff VALUES(9,1,'admin',NULL,'2026-09-21 00:00:00')").run();
  await schema.installForgeBillingSchema(db);
  await assert.rejects(service.getCompanyBillingStatus(1), { status: 503 });
  await service.createCompanyCheckout(1, 'solo', 'month');
  paidSubscription();
  await service.refreshCompanyBilling(1);
  const paid = await service.getCompanyBillingStatus(1, new Date('2026-10-01'));
  assert.equal(paid.reason, 'paid');
  assert.equal(paid.allowed, true);
});

test('new-company public configuration offers 14 days irrespective of the former global cutoff', async () => {
  const db = fixture();
  await schema.installForgeBillingSchema(db);
  process.env.FORGE_BILLING_CUTOFF_AT = '2000-01-01T00:00:00Z';
  assert.deepEqual(await (await routes.public.GET()).json(), { enabled: true, trialDays: 14, trialAvailable: true });
  process.env.FORGE_BILLING_ENABLED = 'false';
  assert.deepEqual(await (await routes.public.GET()).json(), { enabled: false });
});

for (const date of ['invalid', '2026-02-30 12:00:00', '2099-01-01 00:00:00', '2026-09-01']) {
  test(`unpaid company with untrustworthy signup date ${date} requires recovery instead of a fabricated trial`, async () => {
    const db = fixture();
    await db.prepare('UPDATE staff SET created_at=? WHERE company_id=1').run(date);
    await schema.installForgeBillingSchema(db);
    await assert.rejects(service.getCompanyBillingStatus(1, new Date('2026-09-21')), { status: 503 });
    process.env.FORGE_BILLING_ENABLED = 'false';
    assert.equal((await service.getCompanyBillingStatus(1)).allowed, true);
  });
}
