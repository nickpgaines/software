import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,provider,locations} from './helpers/terminal-harness.mjs';

const modules=await loadTerminal();
let database:ReturnType<typeof fixture>;
beforeEach(async()=>{
  database=fixture();process.env.TAP_TO_PAY_ENABLED='true';process.env.TAP_TO_PAY_MODE='test';
  await modules.schema.installTerminalSchema(database.db);
  database.sqlite.exec(`ALTER TABLE staff ADD COLUMN permission_level TEXT;
    ALTER TABLE staff ADD COLUMN custom_role_id INTEGER;
    INSERT OR REPLACE INTO staff (id,company_id,permission_level) VALUES (7,1,'admin');`);
});
afterEach(()=>{database.close();});
function request(path:string,body:unknown={},mode:string|null='test') {
  return new Request(`https://terminal-test.invalid/api/stripe/terminal/${path}`,{method:'POST',headers:{
    Origin:'https://terminal-test.invalid','Content-Type':'application/json','Idempotency-Key':'test-safety-123',
    'X-Forge-Stripe-Account':'acct_1','X-Forge-Terminal-Purpose':'collection',...(mode===null?{}:{'X-Forge-Terminal-Mode':mode}),
  },body:JSON.stringify(body)});
}
test('test token explicitly identifies verified provider mode',async()=>{
  const response=await modules.token.POST(request('connection-token'));
  assert.equal(response.status,200);
  assert.equal((await response.json()).provider_mode,'test');
});
test('declared mode mismatch refuses tokens, locations and intents before effects',async()=>{
  for(const mode of ['live','invalid','']) {
    assert.equal((await modules.token.POST(request('connection-token',{},mode))).status,409);
    assert.equal((await modules.route.POST(request('attempts',{operation:'payment',job_id:12,save_card:false},mode))).status,409);
    assert.equal((await modules.location.POST(request('location',{display_name:'Fake',address:{line1:'123 Main',city:'Chicago',state:'IL',postal_code:'60601',country:'US'}},mode))).status,409);
  }
  assert.equal(provider.tokens.length,0);assert.equal(provider.creates.length,0);assert.equal(locations.creates.length,0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_attempts').get().n,0);
});
test('missing or invalid server mode never silently admits test keys',async()=>{
  for(const mode of [undefined,'','TEST','invalid']) {
    if(mode===undefined)delete process.env.TAP_TO_PAY_MODE;else process.env.TAP_TO_PAY_MODE=mode;
    const response=await modules.token.POST(request('connection-token',{},null));
    assert.equal(response.status,503);
  }
  assert.equal(provider.tokens.length,0);
});
test('mixed key modes refuse direct service writes as well as HTTP requests',async()=>{
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_live_fake';
  await assert.rejects(modules.service.startTerminalAttempt({companyId:1,staffId:7},'key123',{operation:'payment',job_id:12,save_card:false}));
  assert.equal((await modules.token.POST(request('connection-token'))).status,503);
  assert.equal(provider.creates.length,0);assert.equal(provider.tokens.length,0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_attempts').get().n,0);
});
test('test server configuration refuses live secret keys',async()=>{
  process.env.STRIPE_SECRET_KEY='sk_live_fake';
  assert.equal((await modules.route.POST(request('attempts',{operation:'setup',customer_id:90,consent:{accepted:true,version:'terminal-save-v1',customer_name:'Fake'}}))).status,503);
  assert.equal(provider.creates.length,0);
});
test('cached Stripe client cannot be relabeled with a replacement key',async()=>{
  assert.equal((await modules.token.POST(request('connection-token'))).status,200);
  process.env.STRIPE_SECRET_KEY='sk_test_replacement';
  assert.equal((await modules.token.POST(request('connection-token'))).status,503);
  assert.equal(provider.tokens.length,1);
});
test('correct-mode existing attempt can still reconcile and cancel with rollout off',async()=>{
  const response=await modules.route.POST(request('attempts',{operation:'payment',job_id:12,save_card:false}));
  assert.equal(response.status,200);
  const attempt=await response.json();process.env.TAP_TO_PAY_ENABLED='false';
  const canceled=await modules.cancel.POST(request('attempts/'+attempt.attempt_id+'/cancel'),{params:{id:attempt.attempt_id}});
  assert.equal(canceled.status,200);assert.equal((await canceled.json()).status,'canceled');
  assert.equal(provider.creates.length,1);
});
test('provider-free attempt listing remains available without Stripe keys and with a mismatched mode header',async()=>{
  process.env.TAP_TO_PAY_ENABLED='false';delete process.env.STRIPE_SECRET_KEY;delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const response=await modules.route.GET(new Request('https://terminal-test.invalid/api/stripe/terminal/attempts?job_id=12',{headers:{'X-Forge-Terminal-Mode':'live'}}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{attempts:[]});
  assert.equal(provider.tokens.length,0);assert.equal(provider.creates.length,0);
});
