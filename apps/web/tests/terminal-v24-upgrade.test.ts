import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import test from 'node:test';
import { loadRealDbModule, loadRealPaymentDb } from './helpers/payment-harness.mjs';

for (const failFirst of [false, true]) {
  test(`real v24 upgrade installs notices without replaying legacy migrations${failFirst ? ' and retries after failure' : ''}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'terminal-v24-'));
    const url = `file:${join(dir, 'test.db')}`;
    const fixture = createClient({ url });
    const names = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'TURSO_LOCAL_REPLICA_PATH'];
    const previous = names.map(name => process.env[name]);
    process.env.TURSO_DATABASE_URL = url;
    process.env.TURSO_AUTH_TOKEN = 'local-test';
    delete process.env.TURSO_LOCAL_REPLICA_PATH;
    try {
      await loadRealPaymentDb(`?v24-fixture-${failFirst}`);
      // Reconstruct the deployed v24 Terminal schema, retaining an existing attempt.
      await fixture.executeMultiple(`
        DROP TRIGGER terminal_staff_deleted;
        DROP TRIGGER terminal_staff_moved;
        DROP TRIGGER terminal_announcement_staff_deleted;
        DROP TRIGGER terminal_announcement_staff_moved;
        DROP TABLE terminal_outcomes;
        DROP TABLE terminal_notice_acknowledgments;
        DROP TABLE terminal_announcement_acknowledgments;
        DROP INDEX terminal_attempt_actor;
        ALTER TABLE terminal_attempts DROP COLUMN initiating_staff_id;
        ALTER TABLE terminal_attempts DROP COLUMN outcome_revision;
        INSERT INTO terminal_attempts (attempt_id,company_id,customer_id,job_id,operation,idempotency_key,request_fingerprint,stripe_account_id,terminal_location_id,amount_cents,save_card)
          VALUES ('existing',1,90,12,'payment','existing-key','fp','acct_test','tml_test',22500,0);
        UPDATE _schema_version SET version=24;
        -- Full legacy init unconditionally updates company; fail if it replays.
        CREATE TRIGGER prevent_legacy_replay BEFORE UPDATE ON company BEGIN
          SELECT RAISE(ABORT,'legacy company migration replayed');
        END;
      `);
      if (failFirst) {
        // Force a real DDL failure partway through the additive migration.
        await fixture.executeMultiple('CREATE VIEW terminal_outcomes AS SELECT 1 AS id;');
      }
      const module = await loadRealDbModule(`?v24-upgrade-${failFirst}`);
      if (failFirst) {
        await assert.rejects(module.getDb(), /view|terminal_outcomes/i);
        assert.equal((await fixture.execute('SELECT version FROM _schema_version WHERE id=1')).rows[0].version, 24);
        await fixture.executeMultiple('DROP VIEW terminal_outcomes;');
      }
      const db = await module.getDb();
      for (const table of ['terminal_outcomes', 'terminal_notice_acknowledgments', 'terminal_announcement_acknowledgments']) {
        assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).get<{n:number}>())?.n, 0);
      }
      assert.deepEqual(await db.prepare("SELECT amount_cents,status,initiating_staff_id,outcome_revision FROM terminal_attempts WHERE attempt_id='existing'").get(), {
        amount_cents:22500, status:'needs_reconciliation', initiating_staff_id:null, outcome_revision:0,
      });
      assert.equal((await db.prepare('SELECT version FROM _schema_version WHERE id=1').get<{version:number}>())?.version, 25);
      // A new cold start keeps data intact and stays on the fast path.
      const repeated = await loadRealPaymentDb(`?v25-repeat-${failFirst}`);
      assert.equal((await repeated.prepare('SELECT COUNT(*) n FROM terminal_attempts').get<{n:number}>())?.n, 1);
    } finally {
      names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
      fixture.close();
      rmSync(dir, { recursive:true, force:true });
    }
  });
}
