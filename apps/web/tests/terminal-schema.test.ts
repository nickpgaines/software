import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import test from 'node:test';
import { loadRealPaymentDb } from './helpers/payment-harness.mjs';

test('real getDb upgrades v23 cards and initializes fresh Terminal schema idempotently', async () => {
  const dir = mkdtempSync(join(tmpdir(),'terminal-schema-')); const url = `file:${join(dir,'test.db')}`;
  const fixture = createClient({ url });
  const prior = { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN, replica: process.env.TURSO_LOCAL_REPLICA_PATH };
  process.env.TURSO_DATABASE_URL=url; process.env.TURSO_AUTH_TOKEN='local-test'; delete process.env.TURSO_LOCAL_REPLICA_PATH;
  try {
    // First initialize the real complete schema, then reconstruct the previous version's table.
    await loadRealPaymentDb('?terminal-fresh');
    await fixture.executeMultiple(`DROP TABLE terminal_attempts; DROP TABLE stripe_payment_methods;
      CREATE TABLE stripe_payment_methods (id INTEGER PRIMARY KEY,company_id INTEGER,customer_id INTEGER,stripe_customer_id TEXT,stripe_payment_method_id TEXT,brand TEXT,last4 TEXT,exp_month INTEGER,exp_year INTEGER,wallet_type TEXT,is_default INTEGER,created_at TEXT,UNIQUE(company_id,stripe_payment_method_id));
      INSERT INTO stripe_payment_methods VALUES (1,1,90,'cus_existing','pm_existing','visa','4242',12,2099,NULL,1,CURRENT_TIMESTAMP);
      UPDATE _schema_version SET version=23;`);
    const db = await loadRealPaymentDb('?terminal-upgrade');
    const saved = await db.prepare('SELECT requires_explicit_selection,is_default FROM stripe_payment_methods WHERE id=1').get();
    assert.deepEqual(saved,{ requires_explicit_selection:0,is_default:1 });
    const insert = `INSERT INTO terminal_attempts (attempt_id,company_id,customer_id,job_id,operation,idempotency_key,request_fingerprint,stripe_account_id,terminal_location_id,amount_cents,save_card) VALUES (?,1,90,12,'payment',?,'fp','acct_test','tml_test',22500,0)`;
    await db.prepare(insert).run('one','key-one');
    await assert.rejects(db.prepare(insert).run('two','key-two'),/UNIQUE/);
    await db.prepare("UPDATE terminal_attempts SET status='canceled'").run();
    await db.prepare(insert).run('two','key-two');
    const repeated = await loadRealPaymentDb('?terminal-repeat');
    assert.equal((await repeated.prepare('SELECT COUNT(*) n FROM terminal_attempts').get<{n:number}>())?.n,2);
  } finally {
    for (const [env,value] of [['TURSO_DATABASE_URL',prior.url],['TURSO_AUTH_TOKEN',prior.token],['TURSO_LOCAL_REPLICA_PATH',prior.replica]]) { if (value === undefined) delete process.env[env!]; else process.env[env!]=value; }
    fixture.close(); rmSync(dir,{recursive:true,force:true});
  }
});
