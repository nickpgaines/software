import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal} from './helpers/terminal-harness.mjs';
const modules=await loadTerminal();
let database:ReturnType<typeof fixture>;
beforeEach(async()=>{process.env.TAP_TO_PAY_ENABLED='true';database=fixture();await modules.schema.installTerminalSchema(database.db);});
afterEach(()=>{database.close();delete process.env.TAP_TO_PAY_ENABLED;});
const start=()=>modules.service.startTerminalAttempt({companyId:1,staffId:7},'outcome-test',{operation:'payment',job_id:12,save_card:false,initiating_staff_id:8});

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
