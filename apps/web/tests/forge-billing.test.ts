import test from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from '../src/lib/db.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { loadRealPaymentDb } from './helpers/payment-harness.mjs';
import { fixture, loadBilling, provider, paidSubscription, setSession } from './helpers/forge-billing-harness.mjs';
const {service,schema,routes}=await loadBilling();
async function setup() { const db=fixture(); await schema.installForgeBillingSchema(db); return db; }
const request=(name:string, body:unknown={}, headers:Record<string,string>={})=>new Request(`https://forge.test/api/forge-billing/${name}`,{method:'POST',headers:{Origin:'https://forge.test','content-type':'application/json',...headers},body:JSON.stringify(body)});
test('dormant flag does not call provider and exact cutoff closes unpaid access', async()=>{
  await setup(); process.env.FORGE_BILLING_ENABLED='TRUE';
  assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-10-01'))).allowed,true);
  assert.deepEqual(await (await routes.status.GET(new Request('https://forge.test/api/forge-billing/status'))).json(),{enabled:false});
  assert.equal((await routes.checkout.POST(request('checkout',{plan:'solo',interval:'month'}))).status,404);
  assert.equal(provider.calls.length,0);
  process.env.FORGE_BILLING_ENABLED='true';
  assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-09-26T04:59:59.999Z'))).reason,'pre_cutoff');
  assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-09-26T05:00:00Z'))).allowed,false);
});
test('checkout races reserve one session and bind company, price, return origin',async()=>{
  await setup(); const results=await Promise.allSettled(Array.from({length:5},()=>service.createCompanyCheckout(1,'solo','month')));
  assert.ok(results.some(r=>r.status==='fulfilled')); assert.equal(provider.sessions.length,1);
  const call=provider.calls.find(c=>c.checkout); assert.equal(call.checkout.customer,'cus_1'); assert.equal(call.checkout.line_items[0].price,'price_solo_month'); assert.equal(call.checkout.success_url,'https://forge.test/billing?checkout=complete');
  assert.deepEqual(await service.createCompanyCheckout(1,'solo','month'),{url:'https://checkout.stripe.com/test'});
});
test('lost Checkout responses reconcile and never rotate unknown reservations even after cache expiry',async()=>{
  const db=await setup(); provider.lost=true;
  await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month'));
  provider.lost=false; provider.hidden=true;
  await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month'));
  assert.equal(provider.sessions.length,1);
  provider.hidden=false; assert.ok((await service.createCompanyCheckout(1,'solo','month')).url);
  assert.equal(provider.sessions.length,1); assert.equal((await db.prepare('SELECT count(*) n FROM forge_billing_checkout').get()).n,1);
});
test('canonical paid invoice grants through paid period; invalid states and browser return never grant',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); const sub=paidSubscription();
  assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-10-01'))).allowed,false);
  await service.refreshCompanyBilling(1); sub.cancel_at_period_end=true; await service.refreshCompanyBilling(1);
  let status=await service.getCompanyBillingStatus(1,new Date('2026-10-01')); assert.equal(status.allowed,true); assert.equal(status.cancelAtPeriodEnd,true); assert.equal(status.seatLimit,1);
  assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-11-01'))).allowed,false);
  for(const value of ['incomplete','incomplete_expired','unpaid','paused','canceled','unknown','trialing']) { sub.status=value; await service.refreshCompanyBilling(1); assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-10-01'))).allowed,false,value); }
});
test('checkout validates configured price, provider mode, seat count, and existing subscription',async()=>{
  const db=await setup(); provider.invalidPrice=true; await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month')); assert.equal(provider.sessions.length,0);
  provider.invalidPrice=false; provider.mode=true; await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month')); provider.mode=false;
  await db.prepare("INSERT INTO staff VALUES(9,1,'technician',NULL)").run(); await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month'));
  await service.createCompanyCheckout(1,'team','month'); paidSubscription(); await assert.rejects(()=>service.createCompanyCheckout(1,'team','month'));
});
test('routes authenticate, enforce admin permission, native and same origin, and ignore supplied tenant',async()=>{
  await setup(); setSession(null); assert.equal((await routes.status.GET(new Request('https://forge.test'))).status,401);
  setSession({companyId:2,staffId:8,isPlatformAdmin:false}); assert.equal((await routes.checkout.POST(request('checkout',{plan:'solo',interval:'month'}))).status,403);
  setSession({companyId:1,staffId:7,isPlatformAdmin:false});
  assert.equal((await routes.checkout.POST(request('checkout',{plan:'solo',interval:'month'},{Origin:'https://evil.test'}))).status,403);
  assert.equal((await routes.checkout.POST(request('checkout',{plan:'solo',interval:'month'},{Cookie:'forge_native_app=1'}))).status,403);
  assert.equal((await routes.checkout.POST(request('checkout',{plan:'solo',interval:'month',companyId:2}))).status,200);
  assert.equal(provider.customers[0].metadata.forge_company_id,'1');
});
test('webhook rejects signature, Connect, mode and unknown customers; canonical duplicate delivery safe off',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); const sub=paidSubscription();
  const send=()=>routes.webhook.POST(request('webhook',{}, {'stripe-signature':'test'}));
  provider.event={id:'evt_1',type:'customer.subscription.updated',livemode:false,data:{object:sub}};
  provider.invalidSignature=true; assert.equal((await send()).status,400); provider.invalidSignature=false;
  provider.event.account='acct_connected'; assert.equal((await send()).status,400); delete provider.event.account;
  provider.event.livemode=true; assert.equal((await send()).status,400); provider.event.livemode=false;
  process.env.FORGE_BILLING_ENABLED='false'; assert.equal((await send()).status,200); assert.equal((await send()).status,200);
  process.env.FORGE_BILLING_ENABLED='true'; assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-10-01'))).allowed,true);
  provider.fail=true; provider.event.id='evt_2'; assert.equal((await send()).status,503);
});
test('deletion blocks new Checkout, expires sessions and cancels subscription even dormant',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); const sub=paidSubscription(); process.env.FORGE_BILLING_ENABLED='false';
  await service.cancelCompanyBilling(1); assert.equal(sub.status,'canceled'); assert.equal(provider.sessions[0].status,'expired');
  process.env.FORGE_BILLING_ENABLED='true'; await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month'));
});
test('paid status without a paid invoice does not grant entitlement; portal is company bound',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); paidSubscription(); provider.invoices=[];
  await service.refreshCompanyBilling(1); assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-10-01'))).allowed,false);
  await service.createCompanyPortal(1); assert.equal(provider.calls.find(c=>c.portal).portal.customer,'cus_1');
  await assert.rejects(()=>service.createCompanyPortal(2));
});
test('an older canonical fetch cannot restore entitlement after a newer cancellation',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); const sub=paidSubscription();
  let release!:()=>void; let entered!:()=>void;
  const started=new Promise<void>(r=>{entered=r}); const held=new Promise<void>(r=>{release=r});
  provider.beforeRetrieve=async()=>{provider.beforeRetrieve=null;entered();await held;};
  const older=service.refreshCompanyBilling(1); await started; sub.status='canceled';
  await service.refreshCompanyBilling(1); release(); await assert.rejects(older);
  assert.equal((await service.getCompanyBillingStatus(1,new Date('2026-10-01'))).allowed,false);
});
test('uncertain Checkout blocks deletion and staff insertion until reconciliation',async()=>{
  const db=await setup(); provider.lost=true; await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month')); provider.hidden=true;
  await assert.rejects(()=>service.cancelCompanyBilling(1)); await assert.rejects(()=>db.transaction((tx:Db)=>service.assertCompanyNotDeleting(tx,1)));
  provider.hidden=false; await service.cancelCompanyBilling(1); assert.equal(provider.sessions[0].status,'expired');
});
test('expired Checkout can change plans',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); provider.sessions[0].status='expired';
  await service.createCompanyCheckout(1,'team','year'); assert.equal(provider.sessions.length,2);
});
test('completed Checkout for a canceled subscription can be purchased again',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); const sub=paidSubscription(); await service.refreshCompanyBilling(1);
  provider.sessions[0].status='complete'; sub.status='canceled';
  await service.createCompanyCheckout(1,'team','month'); assert.equal(provider.sessions.length,2);
});
test('custom billing permissions are tenant scoped and status remains available to staff',async()=>{
  const db=await setup(); await db.prepare('INSERT INTO custom_roles VALUES(1,1,?)').run('["settings.view_all"]');
  await db.prepare('UPDATE staff SET custom_role_id=1 WHERE id=8').run();
  assert.equal(await service.canManageBilling({companyId:2,staffId:8,identity:'other',isPlatformAdmin:false}),false);
  await db.prepare('UPDATE custom_roles SET company_id=2 WHERE id=1').run();
  assert.equal(await service.canManageBilling({companyId:2,staffId:8,identity:'other',isPlatformAdmin:false}),true);
  setSession({companyId:2,staffId:8,isPlatformAdmin:false}); const status=await (await routes.status.GET(new Request('https://forge.test'))).json(); assert.equal(status.staffCount,1);
});
test('unknown customer webhook never creates billing state and unavailable database/provider is retryable',async()=>{
  const db=await setup(); provider.event={id:'evt_unknown',type:'invoice.paid',livemode:false,data:{object:{customer:'cus_unknown'}}};
  assert.equal((await routes.webhook.POST(request('webhook',{}, {'stripe-signature':'test'}))).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM forge_billing_accounts').get()).n,0);
  await service.createCompanyCheckout(1,'solo','month'); provider.fail=true;
  assert.equal((await routes.refresh.POST(request('refresh'))).status,503);
});
test('configured platform identity changes and unsafe portal plan editing fail closed',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month');
  process.env.FORGE_BILLING_STRIPE_ACCOUNT_ID='acct_wrong'; await assert.rejects(()=>service.createCompanyPortal(1));
  process.env.FORGE_BILLING_STRIPE_ACCOUNT_ID='acct_platform';
  provider.api.billingPortal.configurations.retrieve=async()=>({active:true,livemode:false,features:{subscription_update:{enabled:true},subscription_cancel:{enabled:true},payment_method_update:{enabled:true}}});
  await assert.rejects(()=>service.createCompanyPortal(1));
});
test('deletion refuses completed Checkout whose subscription outcome is still unknown',async()=>{
  await setup(); await service.createCompanyCheckout(1,'solo','month'); provider.sessions[0].status='complete';
  await assert.rejects(()=>service.cancelCompanyBilling(1));
});
test('dormant rollout ignores incomplete billing setup and malformed cutoff',async()=>{
  await setup(); process.env.FORGE_BILLING_ENABLED='false'; process.env.FORGE_BILLING_CUTOFF_AT='invalid';
  delete process.env.FORGE_BILLING_STRIPE_SECRET_KEY;
  assert.equal((await service.getCompanyBillingStatus(1)).allowed,true);
  assert.deepEqual(await (await routes.public.GET()).json(),{enabled:false});
});
test('customer creation lost response never creates a second customer or Checkout',async()=>{
  await setup(); const create=provider.api.customers.create;
  provider.api.customers.create=async (...args:unknown[])=>{await create(...args);throw new Error('lost customer response');};
  await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month'));
  await assert.rejects(()=>service.createCompanyCheckout(1,'solo','month'));
  assert.equal(provider.customers.length,1); assert.equal(provider.sessions.length,0);
});
test('real getDb installs isolated billing schema on existing v24 fast path without changing company data',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'forge-billing-schema-')); const url=`file:${join(dir,'test.db')}`;
  const client=createClient({url});
  const previous=[process.env.TURSO_DATABASE_URL,process.env.TURSO_AUTH_TOKEN,process.env.TURSO_LOCAL_REPLICA_PATH];
  process.env.TURSO_DATABASE_URL=url; process.env.TURSO_AUTH_TOKEN='local-test'; delete process.env.TURSO_LOCAL_REPLICA_PATH;
  try {
    await client.executeMultiple("CREATE TABLE _schema_version(id INTEGER PRIMARY KEY,version INTEGER); INSERT INTO _schema_version VALUES(1,24); CREATE TABLE company(id INTEGER PRIMARY KEY); INSERT INTO company VALUES(1);");
    const db=await loadRealPaymentDb('?forge-billing-v24');
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM forge_billing_accounts').get<{n:number}>())?.n,0);
    await schema.installForgeBillingSchema(db);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM company').get<{n:number}>())?.n,1);
  } finally {
    for(const [i,name] of ['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','TURSO_LOCAL_REPLICA_PATH'].entries()) {if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];}
    client.close(); rmSync(dir,{recursive:true,force:true});
  }
});
