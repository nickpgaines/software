import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,accounts} from './helpers/terminal-harness.mjs';
const m=await loadTerminal();let db:ReturnType<typeof fixture>;
beforeEach(async()=>{db=fixture();process.env.TAP_TO_PAY_ENABLED='true';await m.schema.installTerminalSchema(db.db);});
afterEach(()=>{db.close();delete process.env.TAP_TO_PAY_ENABLED;});
test('fresh provider eligibility overrides stale cached approval without financial mutations',async()=>{
  assert.equal((await m.eligibility.getTerminalEligibility(1)).eligible,true);
  accounts.charges=false;assert.equal((await m.eligibility.getTerminalEligibility(1)).eligible,false);
  accounts.charges=true;accounts.country='CA';assert.equal((await m.eligibility.getTerminalEligibility(1)).eligible,false);
});
test('provider failure and account remapping during lookup cannot claim eligible',async()=>{
  accounts.fail=true;await assert.rejects(m.eligibility.getTerminalEligibility(1));accounts.fail=false;
  accounts.afterRetrieve=async()=>{db.sqlite.exec("UPDATE company SET stripe_account_id='acct_other' WHERE id=1");};
  await assert.rejects(m.eligibility.getTerminalEligibility(1));
});
test('a delayed onboarding return never restores a previously connected account',async()=>{
  db.sqlite.exec('ALTER TABLE company ADD COLUMN stripe_payouts_enabled INTEGER; ALTER TABLE company ADD COLUMN stripe_details_submitted INTEGER;');
  accounts.afterRetrieve=async()=>{db.sqlite.exec("UPDATE company SET stripe_account_id='acct_other' WHERE id=1");};
  const response=await m.onboardingReturn.GET(new Request('https://www.forgecrm.app/api/stripe/connect/return?success=true'));
  assert.equal(new URL(response.headers.get('Location')!).pathname,'/settings');
  assert.equal(new URL(response.headers.get('Location')!).search,'?tab=payments');
  assert.equal(db.sqlite.prepare('SELECT stripe_account_id FROM company WHERE id=1').get().stripe_account_id,'acct_other');
});
