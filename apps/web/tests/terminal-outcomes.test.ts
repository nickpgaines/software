import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,provider} from './helpers/terminal-harness.mjs';
const modules=await loadTerminal();
let database:ReturnType<typeof fixture>;
beforeEach(async()=>{process.env.TAP_TO_PAY_ENABLED='true';database=fixture();await modules.schema.installTerminalSchema(database.db);});
afterEach(()=>{database.close();delete process.env.TAP_TO_PAY_ENABLED;});
const start=()=>modules.service.startTerminalAttempt({companyId:1,staffId:7},'outcome-test',{operation:'payment',job_id:12,save_card:false,initiating_staff_id:8});
function declined(id:string,overrides:any={}) {
  const intent=provider.intents[0];
  const charge={id,account:'acct_1',payment_intent:intent.id,metadata:{...intent.metadata},livemode:false,amount:22500,currency:'usd',status:'failed',paid:false,created:1790416800+provider.charges.length,
    payment_method_details:{type:'card_present',card_present:{brand:'visa',last4:'0341',receipt:{application_preferred_name:'VISA',dedicated_file_name:'A0000000031010'}}},...overrides};
  provider.charges.push(charge);return charge;
}
const observations=()=>database.sqlite.prepare('SELECT * FROM terminal_outcomes ORDER BY occurred_at,id').all();
test('two declined taps and later approval are durable distinct facts across webhook redelivery',async()=>{
  const attempt=await start();declined('ch_first');
  await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id);
  declined('ch_second');await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id);
  provider.intents[0].status='succeeded';
  await Promise.all([modules.service.reconcileTerminalAttempt(1,attempt.attempt_id),modules.service.reconcileTerminalAttempt(1,attempt.attempt_id)]);
  assert.deepEqual(observations().map((row:any)=>row.kind).sort(),['approved','declined','declined']);
  const revision=database.sqlite.prepare('SELECT outcome_revision FROM terminal_attempts').get().outcome_revision;
  provider.event={id:'evt_late',type:'charge.failed',account:'acct_1',data:{object:provider.charges[0]}};
  const req=()=>new Request('https://www.forgecrm.app/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'valid'},body:'{}'});
  assert.equal((await modules.webhook.POST(req())).status,200);assert.equal((await modules.webhook.POST(req())).status,200);
  assert.equal(observations().length,3);
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
  assert.equal(database.sqlite.prepare('SELECT outcome_revision FROM terminal_attempts').get().outcome_revision,revision);
});
for(const [name,patch] of Object.entries({mode:{livemode:true},intent:{payment_intent:'pi_wrong'},metadata:{metadata:{terminal_attempt_id:'wrong'}},amount:{amount:22499},currency:{currency:'eur'},paid:{paid:true},status:{status:'pending'},method:{payment_method_details:{type:'card'}}})) {
  test(`invalid ${name} is not a verified declined outcome`,async()=>{
    const attempt=await start();const charge=declined('ch_wrong',patch);
    // A signed event still requires fresh Charge and parent binding checks.
    provider.event={id:'evt_wrong',type:'charge.failed',account:'acct_1',data:{object:{...charge,metadata:{terminal_attempt_id:attempt.attempt_id}}}};
    assert.equal((await modules.webhook.POST(new Request('https://www.forgecrm.app/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'valid'},body:'{}'}))).status,500);
    assert.equal(observations().length,0);
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) n FROM terminal_attempts WHERE status NOT IN ('succeeded','canceled')").get().n,1);
  });
}
test('transport uncertainty and setup intent errors never produce declines',async()=>{
  const attempt=await start();provider.intents[0].last_payment_error={code:'card_declined'};
  await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id);assert.equal(observations().length,0);
});
test('incomplete Charge history remains retryable and preserves reservation',async()=>{
  const attempt=await start();declined('ch_1');provider.chargeHasMore=true;
  await assert.rejects(modules.service.reconcileTerminalAttempt(1,attempt.attempt_id));
  assert.equal(observations().length,0);
  assert.equal(database.sqlite.prepare('SELECT status FROM terminal_attempts').get().status,'ready');
});
test('outcome write failure after recording money retries without recording it twice',async()=>{
  const attempt=await start();provider.intents[0].status='succeeded';
  database.sqlite.exec(`CREATE TRIGGER fail_outcome BEFORE INSERT ON terminal_outcomes BEGIN SELECT RAISE(ABORT,'temporary storage failure'); END;`);
  await assert.rejects(modules.service.reconcileTerminalAttempt(1,attempt.attempt_id));
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
  database.sqlite.exec('DROP TRIGGER fail_outcome');
  await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id);
  assert.equal(observations().length,1);assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
});
test('foreign-account Charge events cannot create observations',async()=>{
  await start();const charge=declined('ch_other',{account:'acct_2'});
  provider.event={id:'evt_other',type:'charge.failed',account:'acct_2',data:{object:charge}};
  const response=await modules.webhook.POST(new Request('https://www.forgecrm.app/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'valid'},body:'{}'}));
  assert.equal(response.status,500);assert.equal(observations().length,0);
});
test('cancellation is verified and setup-only errors do not fabricate payment declines',async()=>{
  const attempt=await modules.service.startTerminalAttempt({companyId:1,staffId:7},'setup',{operation:'setup',customer_id:90,consent:{accepted:true,version:'terminal-save-v1',customer_name:'Ada'}});
  provider.intents[0].last_setup_error={code:'card_declined'};
  await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id);assert.equal(observations().length,0);
  await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id,true);
  assert.deepEqual(observations().map((row:any)=>row.kind),['canceled']);
});

test('attempt captures authenticated initiator separately from optional save consent',async()=>{
  const attempt=await start();
  const stored=database.sqlite.prepare('SELECT * FROM terminal_attempts WHERE attempt_id=?').get(attempt.attempt_id);
  assert.equal(stored.initiating_staff_id,7);assert.equal(stored.consent_staff_id,null);
  const revision=stored.outcome_revision;
  await modules.service.reconcileTerminalAttempt(1,attempt.attempt_id);
  assert.equal(database.sqlite.prepare('SELECT outcome_revision FROM terminal_attempts').get().outcome_revision,revision);
});
test('deleting staff removes personal ownership and acknowledgments but preserves original payment recovery',async()=>{
  const attempt=await start();
  database.sqlite.prepare('INSERT INTO terminal_notice_acknowledgments (company_id,staff_id,notice_id) VALUES (1,7,?)').run('attention:test:1');
  database.sqlite.prepare('DELETE FROM staff WHERE id=7').run();
  const stored=database.sqlite.prepare('SELECT * FROM terminal_attempts WHERE attempt_id=?').get(attempt.attempt_id);
  assert.equal(stored.initiating_staff_id,null);assert.equal(stored.status,'ready');
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_notice_acknowledgments').get().n,0);
});
test('repeated and competing schema installation preserves legacy writers and does not invent outcomes',async()=>{
  database.sqlite.exec(`DROP INDEX IF EXISTS terminal_attempt_actor; DROP TRIGGER IF EXISTS terminal_staff_deleted; DROP TRIGGER IF EXISTS terminal_staff_moved;`);
  for(const column of ['initiating_staff_id','outcome_revision']) {
    if(database.sqlite.prepare('PRAGMA table_info(terminal_attempts)').all().some((row:any)=>row.name===column))database.sqlite.exec(`ALTER TABLE terminal_attempts DROP COLUMN ${column}`);
  }
  await Promise.all([modules.schema.installTerminalSchema(database.db),modules.schema.installTerminalSchema(database.db)]);
  database.sqlite.exec(`INSERT INTO terminal_attempts (attempt_id,company_id,customer_id,operation,idempotency_key,request_fingerprint,stripe_account_id,terminal_location_id,amount_cents,save_card) VALUES ('legacy',1,90,'setup','legacy','old','acct_1','tml_test',0,1)`);
  const row=database.sqlite.prepare('SELECT initiating_staff_id,outcome_revision FROM terminal_attempts WHERE attempt_id=?').get('legacy');
  assert.deepEqual({...row},{initiating_staff_id:null,outcome_revision:0});
  assert.equal(database.sqlite.prepare('SELECT COUNT(*) n FROM terminal_outcomes').get().n,0);
});
test('company deletion cascades private observations and acknowledgments',async()=>{
  const attempt=await start();database.sqlite.exec('PRAGMA foreign_keys=ON');
  database.sqlite.prepare(`INSERT INTO terminal_outcomes VALUES ('notice',1,?,'acct_1','ch_1','declined','2026-09-26T12:00:00Z','{}')`).run(attempt.attempt_id);
  database.sqlite.exec(`INSERT INTO terminal_notice_acknowledgments (company_id,staff_id,notice_id) VALUES (1,7,'notice'); DELETE FROM company WHERE id=1`);
  for(const table of ['terminal_attempts','terminal_outcomes','terminal_notice_acknowledgments'])assert.equal(database.sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
});
