import assert from 'node:assert/strict';
import {test, beforeEach, afterEach} from 'node:test';
import {fixture,loadTerminal,provider,setSession} from './helpers/terminal-harness.mjs';

const m=await loadTerminal({receipts:true});
let db:ReturnType<typeof fixture>;
beforeEach(async()=>{db=fixture();process.env.TAP_TO_PAY_ENABLED='true';await m.schema.installTerminalSchema(db.db);});
afterEach(()=>{db.close();delete process.env.TAP_TO_PAY_ENABLED;});
const req=(path:string,body?:unknown,origin='https://www.forgecrm.app')=>new Request(`https://www.forgecrm.app/api/stripe/terminal/${path}`,body===undefined?{}:{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
async function payment(success=true){
  const a=await m.service.startTerminalAttempt({companyId:1,staffId:7},'receipt-test',{operation:'payment',job_id:12,save_card:false});
  const pi=provider.intents[0];
  Object.assign(pi,{livemode:false,status:success?'succeeded':'requires_payment_method',latest_charge:{id:'ch_paid',payment_intent:pi.id,status:success?'succeeded':'failed',paid:success,captured:success,amount:22500,amount_captured:22500,amount_refunded:0,currency:'usd',livemode:false,created:1790000000,receipt_url:'https://pay.stripe.com/receipts/payment/fixture',payment_method_details:{type:'card_present',card_present:{}}}});
  if(success)await m.service.reconcileTerminalAttempt(1,a.attempt_id);
  return {a,pi};
}
const get=(id:string)=>m.receipt!.GET(req(`attempts/${id}/receipt`),{params:{id}});
const post=(id:string,email:unknown,origin?:string)=>m.receipt!.POST(req(`attempts/${id}/receipt`,{email},origin),{params:{id}});

test('verified receipt GET exposes only receipt fields; refunds remain visible',async()=>{
  const {a,pi}=await payment();pi.latest_charge.amount_refunded=500;
  const res=await get(a.attempt_id);assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{attempt_id:a.attempt_id,amount_cents:22500,refunded_cents:500,created:1790000000,receipt_url:'https://pay.stripe.com/receipts/payment/fixture',test_mode:true});
  assert.equal(provider.updates.length,0);
});
test('receipt email only updates receipt_email with an account-bound stable retry key and no financial effects',async()=>{
  const {a,pi}=await payment();const before=db.sqlite.prepare('SELECT * FROM payments').all();
  for(let n=0;n<2;n++)assert.deepEqual(await(await post(a.attempt_id,'  guest@example.com  ')).json(),{status:'test_only'});
  assert.equal(provider.updates.length,2);
  const update=provider.updates[0] as any;
  assert.equal(update.id,pi.id);assert.deepEqual(update.body,{receipt_email:'guest@example.com'});
  assert.equal(update.options.stripeAccount,'acct_1');assert.ok(update.options.idempotencyKey);
  assert.equal((provider.updates[1] as any).options.idempotencyKey,update.options.idempotencyKey);
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM payments').all(),before);
  assert.equal(provider.creates.length,1);assert.equal(provider.cancelCalls.length,0);
});
test('receipt requests reject live mode against test credentials',async()=>{
  const {a,pi}=await payment();
  // The harness singleton already uses test credentials. Live key drift must fail closed.
  process.env.TAP_TO_PAY_MODE='live';pi.livemode=true;pi.latest_charge.livemode=true;
  assert.equal((await post(a.attempt_id,'guest@example.com')).status,503);
  assert.equal(provider.updates.length,0);
});
test('prior receipts survive rollout and charge disablement; history remains database-only',async()=>{
  const {a}=await payment();process.env.TAP_TO_PAY_ENABLED='false';
  db.sqlite.prepare('UPDATE company SET stripe_charges_enabled=0 WHERE id=1').run();
  assert.equal((await post(a.attempt_id,'guest@example.com')).status,200);
  provider.failLookup=true;
  const list=await m.receipts!.GET(req('receipts?job_id=12'));
  assert.equal(list.status,200);const body=await list.json();assert.equal(body.receipts.length,1);
  assert.equal(body.receipts[0].attempt_id,a.attempt_id);assert.equal(body.receipts[0].amount_cents,22500);
  assert.deepEqual(Object.keys(body.receipts[0]).sort(),['amount_cents','attempt_id','created_at']);
  setSession({companyId:2,staffId:8,identity:'staff:8'});
  assert.equal((await m.receipts!.GET(req('receipts?job_id=12'))).status,404);
});
test('receipt routes enforce authentication, company isolation and same origin',async()=>{
  const {a}=await payment();setSession(null);assert.equal((await get(a.attempt_id)).status,401);
  setSession({companyId:2,staffId:8,identity:'staff:8'});assert.equal((await get(a.attempt_id)).status,404);
  setSession({companyId:1,staffId:7,identity:'staff:7'});
  assert.equal((await post(a.attempt_id,'guest@example.com','https://evil.example')).status,403);
  db.sqlite.prepare("UPDATE company SET stripe_account_id='acct_other' WHERE id=1").run();
  assert.equal((await post(a.attempt_id,'guest@example.com')).status,409);assert.equal(provider.updates.length,0);
});
for(const email of [null,'','two addresses@example.com','a@b','a@example.com\r\nBcc:bad@example.com',42,'a'.repeat(255)+'@example.com'])test(`invalid email rejected: ${String(email).slice(0,25)}`,async()=>{
  const {a}=await payment();assert.equal((await post(a.attempt_id,email)).status,400);assert.equal(provider.updates.length,0);
});
for(const change of [
  (pi:any)=>{pi.status='processing';},(pi:any)=>{pi.status='canceled';},
  (pi:any)=>{pi.latest_charge=null;},(pi:any)=>{pi.latest_charge='ch_unexpanded';},
  (pi:any)=>{pi.metadata.company_id='2';},(pi:any)=>{pi.latest_charge.payment_intent='pi_other';},
  (pi:any)=>{pi.latest_charge.captured=false;},(pi:any)=>{pi.latest_charge.paid=false;},
  (pi:any)=>{pi.latest_charge.amount=100;},(pi:any)=>{pi.latest_charge.amount_captured=100;},
  (pi:any)=>{pi.latest_charge.status='failed';},(pi:any)=>{pi.latest_charge.livemode=true;},
  (pi:any)=>{pi.livemode=true;},(pi:any)=>{pi.latest_charge.payment_method_details.type='card';},
])test(`invalid receipt provider binding ${change}`,async()=>{
  const {a,pi}=await payment();change(pi);assert.equal((await post(a.attempt_id,'guest@example.com')).status,409);assert.equal(provider.updates.length,0);
});
test('setup attempts and unknown attempts never have payment receipts',async()=>{
  const a=await m.service.startTerminalAttempt({companyId:1,staffId:7},'setup',{operation:'setup',customer_id:90,consent:{accepted:true,version:'terminal-save-v1',customer_name:'Ada'}});
  assert.equal((await get(a.attempt_id)).status,409);assert.equal((await get('missing')).status,404);assert.equal(provider.updates.length,0);
});
for(const url of ['http://pay.stripe.com/receipts/x','https://pay.stripe.com.evil.test/receipts/x','javascript:alert(1)','https://evil.test/receipts/x','https://user@pay.stripe.com/receipts/x','https://pay.stripe.com/elsewhere'])test(`unsafe receipt URL omitted: ${url}`,async()=>{
  const {a,pi}=await payment();pi.latest_charge.receipt_url=url;
  assert.equal((await(await get(a.attempt_id)).json()).receipt_url,null);
});
test('receipt provider outage neither alters confirmed payment nor requests another charge',async()=>{
  const {a}=await payment();provider.failLookup=true;
  const response=await post(a.attempt_id,'guest@example.com');assert.equal(response.status,503);
  assert.match((await response.json()).error,/receipt/i);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
  assert.equal(provider.creates.length,1);assert.equal(provider.updates.length,0);
});
test('decline hint requires fresh provider card_declined and does not release the original attempt',async()=>{
  const {a,pi}=await payment(false);pi.last_payment_error={code:'card_declined'};
  const declined=await m.service.reconcileTerminalAttempt(1,a.attempt_id);
  assert.equal(declined.payment_declined,true);assert.equal(declined.status,'ready');assert.equal(declined.payment_recorded,false);
  pi.status='canceled';assert.equal((await m.service.reconcileTerminalAttempt(1,a.attempt_id)).payment_declined,undefined);
});
test('non-decline provider errors and fresh attempts are never described as declined',async()=>{
  const {a,pi}=await payment(false);assert.equal((await m.service.reconcileTerminalAttempt(1,a.attempt_id)).payment_declined,undefined);
  pi.last_payment_error={code:'processing_error'};assert.equal((await m.service.reconcileTerminalAttempt(1,a.attempt_id)).payment_declined,undefined);
});
