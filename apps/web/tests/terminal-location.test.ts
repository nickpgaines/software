import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,locations,setSession,provider} from './helpers/terminal-harness.mjs';

const modules = await loadTerminal();
let database: ReturnType<typeof fixture>;
const original = process.env.TAP_TO_PAY_ENABLED;
const address = {line1:'123 Main St',city:'Chicago',state:'IL',postal_code:'60601',country:'US'};
const merchantLocation = (id='tml_test', account='acct_1') => ({id,account,display_name:'Merchant',address:{...address}});
const request = (body?: unknown, origin='https://www.forgecrm.app') => new Request('https://www.forgecrm.app/api/stripe/terminal/location', body === undefined ? {} : {
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),
});
beforeEach(() => {
  database = fixture(); process.env.TAP_TO_PAY_ENABLED='true';
  database.sqlite.exec(`ALTER TABLE staff ADD COLUMN permission_level TEXT;
    ALTER TABLE staff ADD COLUMN custom_role_id INTEGER;
    CREATE TABLE custom_roles (id INTEGER PRIMARY KEY,company_id INTEGER,permissions TEXT);
    INSERT OR REPLACE INTO staff (id,company_id,permission_level,custom_role_id) VALUES (7,1,'admin',NULL),(8,1,'technician',NULL),(9,2,'admin',NULL);`);
  locations.data=[merchantLocation()];
});
afterEach(() => { database.close(); if(original === undefined) delete process.env.TAP_TO_PAY_ENABLED; else process.env.TAP_TO_PAY_ENABLED=original; });

test('location GET is read-only, uncached, account-scoped and reports current setup permission', async () => {
  database.sqlite.exec('DELETE FROM stripe_terminal_locations');
  const response = await modules.location.GET(request());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.selected_location_id,'tml_test');
  assert.equal(body.can_manage,true);
  assert.equal(body.stripe_account,'acct_1');
  assert.equal(body.locations.length,1);
  assert.match(response.headers.get('Cache-Control') ?? '',/no-store/);
  assert.equal(locations.creates.length,0);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM stripe_terminal_locations').get().n,0);
  assert.ok(locations.calls.every(call => call.options.stripeAccount === 'acct_1'));
});
test('ordinary staff may inspect setup but cannot change merchant locations', async () => {
  setSession({companyId:1,staffId:8});
  assert.equal((await (await modules.location.GET(request())).json()).can_manage,false);
  assert.equal((await modules.location.POST(request({location_id:'tml_test'}))).status,403);
  assert.equal(locations.creates.length,0);
});
test('custom setup permission is honored while foreign or malformed roles fail closed', async () => {
  database.sqlite.exec(`INSERT INTO custom_roles VALUES(10,1,'["settings.view_all"]'),(11,2,'["settings.view_all"]');
    UPDATE staff SET custom_role_id=10 WHERE id=7;`);
  assert.equal((await modules.location.POST(request({location_id:'tml_test'}))).status,200);
  database.sqlite.exec('UPDATE staff SET custom_role_id=11 WHERE id=7');
  assert.equal((await modules.location.POST(request({location_id:'tml_test'}))).status,403);
  database.sqlite.exec("UPDATE staff SET custom_role_id=10 WHERE id=7; UPDATE custom_roles SET permissions='null' WHERE id=10");
  assert.equal((await modules.location.POST(request({location_id:'tml_test'}))).status,403);
});
test('unauthenticated, cross-origin, and disabled rollout requests have no provider effects', async () => {
  setSession(null);
  assert.equal((await modules.location.GET(request())).status,401);
  assert.equal((await modules.location.POST(request({location_id:'tml_test'}))).status,401);
  setSession({companyId:1,staffId:7});
  assert.equal((await modules.location.POST(request({location_id:'tml_test'},'https://untrusted.invalid'))).status,403);
  process.env.TAP_TO_PAY_ENABLED='false';
  assert.equal((await modules.location.POST(request({location_id:'tml_test'}))).status,409);
  assert.equal(locations.calls.length,0); assert.equal(locations.creates.length,0);
});
test('selects only a valid location from the current merchant account', async () => {
  locations.data=[merchantLocation('tml_selected'),merchantLocation('tml_foreign','acct_2')];
  assert.equal((await modules.location.POST(request({location_id:'tml_foreign'}))).status,400);
  const response=await modules.location.POST(request({location_id:'tml_selected'}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).location_id,'tml_selected');
  assert.equal(database.sqlite.prepare('SELECT stripe_terminal_location_id id FROM stripe_terminal_locations').get().id,'tml_selected');
});
test('explicit creation uses a complete address, stable idempotency and no payment intent', async () => {
  const body={display_name:'My business',address};
  for(let i=0;i<2;i++) assert.equal((await modules.location.POST(request(body))).status,200);
  assert.equal(locations.creates.length,2);
  assert.deepEqual(locations.creates[0].body,body);
  assert.equal(locations.creates[0].options.stripeAccount,'acct_1');
  assert.ok(locations.creates[0].options.idempotencyKey);
  assert.equal(locations.creates[0].options.idempotencyKey,locations.creates[1].options.idempotencyKey);
  assert.equal(provider.creates.length,0);
});
test('placeholder, unsupported, incomplete and ambiguous address requests never create a location', async () => {
  for(const body of [null,{}, {display_name:'Merchant',address:{...address,city:'Unspecified'}},
    {display_name:'Merchant',address:{...address,postal_code:'00000'}},
    {display_name:'Merchant',address:{...address,state:'ZZ'}},
    {display_name:'Merchant',address:{...address,country:'CA'}},
    {display_name:'Merchant',address:{...address,line1:''}},
    {location_id:'tml_test',display_name:'Merchant',address}]) {
    assert.equal((await modules.location.POST(request(body))).status,400);
  }
  assert.equal(locations.creates.length,0);
});
test('multiple or paginated candidates require explicit selection, provider failures do not invent locations', async () => {
  database.sqlite.exec('DELETE FROM stripe_terminal_locations');
  locations.data=[merchantLocation(),merchantLocation('tml_second')];
  assert.equal((await (await modules.location.GET(request())).json()).selected_location_id,null);
  locations.data=[merchantLocation()]; locations.hasMore=true;
  assert.equal((await (await modules.location.GET(request())).json()).selected_location_id,null);
  locations.fail=true;
  assert.equal((await modules.location.GET(request())).status,503);
  assert.equal(locations.creates.length,0);
});
test('connected-account change during location validation cannot persist the stale selection', async () => {
  locations.data=[merchantLocation('tml_new')];
  locations.afterRetrieve=() => database.sqlite.exec("UPDATE company SET stripe_account_id='acct_2' WHERE id=1");
  assert.equal((await modules.location.POST(request({location_id:'tml_new'}))).status,409);
  assert.equal(database.sqlite.prepare('SELECT stripe_terminal_location_id id FROM stripe_terminal_locations').get().id,'tml_test');
});
test('revoked setup permission during provider validation cannot persist a new location', async () => {
  locations.data=[merchantLocation('tml_new')];
  locations.afterRetrieve=() => database.sqlite.exec("UPDATE staff SET permission_level='technician' WHERE id=7");
  assert.equal((await modules.location.POST(request({location_id:'tml_new'}))).status,403);
  assert.equal(database.sqlite.prepare('SELECT stripe_terminal_location_id id FROM stripe_terminal_locations').get().id,'tml_test');
});
test('deleted and placeholder provider locations cannot be selected', async () => {
  locations.data=[{...merchantLocation('tml_deleted'),deleted:true}, {...merchantLocation('tml_bad'),address:{...address,state:'NA'}}];
  for(const id of ['tml_deleted','tml_bad']) assert.equal((await modules.location.POST(request({location_id:id}))).status,400);
});
test('legacy checkout cannot reuse a foreign cached location or create a placeholder', async () => {
  locations.data=[merchantLocation('tml_test','acct_2')];
  await assert.rejects(modules.stripe.getOrCreateTerminalLocation(1,'acct_1'),/location/i);
  database.sqlite.exec('DELETE FROM stripe_terminal_locations');
  await assert.rejects(modules.stripe.getOrCreateTerminalLocation(1,'acct_1'),/location/i);
  assert.equal(locations.creates.length,0);
});
test('legacy checkout retrieves the explicitly selected location rather than silently switching on provider failure', async () => {
  locations.fail=true;
  await assert.rejects(modules.stripe.getOrCreateTerminalLocation(1,'acct_1'),/provider unavailable/);
  assert.equal(locations.creates.length,0);
});
test('legacy checkout returns the validated location even if another request changes the cache', async () => {
  locations.afterRetrieve=() => database.sqlite.exec("UPDATE stripe_terminal_locations SET stripe_terminal_location_id='tml_unvalidated'");
  const result = await modules.stripe.getOrCreateTerminalLocation(1,'acct_1');
  assert.equal(result.stripe_terminal_location_id,'tml_test');
});

const tokenRequest = (purpose?:string, representative?:string) => {
  const req=request({});
  req.headers.set('X-Forge-Stripe-Account','acct_1');
  if(purpose) req.headers.set('X-Forge-Terminal-Purpose',purpose);
  if(representative) req.headers.set('X-Forge-Authorized-Representative',representative);
  return req;
};
test('collection and ordinary preparation tokens never authorize merchant terms', async () => {
  for(const purpose of [undefined,'collection','preparation']) {
    const response=await modules.token.POST(tokenRequest(purpose));
    assert.equal(response.status,200);
    assert.equal((await response.json()).tos_acceptance_permitted,false);
  }
});
test('terms require both explicit representative confirmation and current setup permission on every token', async () => {
  const response=await modules.token.POST(tokenRequest('preparation','true'));
  assert.equal(response.status,200);
  assert.equal((await response.json()).tos_acceptance_permitted,true);
  database.sqlite.exec("UPDATE staff SET permission_level='technician' WHERE id=7");
  assert.equal((await modules.token.POST(tokenRequest('preparation','true'))).status,403);
  assert.equal(provider.tokens.length,1);
});
test('forged or malformed setup purpose cannot authorize merchant terms', async () => {
  for(const [purpose,confirmation] of [['collection','true'],['other','true'],['preparation','yes']]) {
    assert.equal((await modules.token.POST(tokenRequest(purpose,confirmation))).status,400);
  }
  assert.equal(provider.tokens.length,0);
});
test('rollout-off and changed-account setup tokens are denied', async () => {
  process.env.TAP_TO_PAY_ENABLED='false';
  assert.equal((await modules.token.POST(tokenRequest('preparation','true'))).status,409);
  process.env.TAP_TO_PAY_ENABLED='true';
  database.sqlite.exec("UPDATE company SET stripe_account_id='acct_2' WHERE id=1");
  assert.equal((await modules.token.POST(tokenRequest('preparation','true'))).status,409);
  assert.equal(provider.tokens.length,0);
});
