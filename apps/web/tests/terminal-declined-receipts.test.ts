import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,provider} from './helpers/terminal-harness.mjs';
const m=await loadTerminal();let db:ReturnType<typeof fixture>;
beforeEach(async()=>{db=fixture();process.env.TAP_TO_PAY_ENABLED='true';await m.schema.installTerminalSchema(db.db);});
afterEach(()=>{db.close();delete process.env.TAP_TO_PAY_ENABLED;});
async function decline() {
  const a=await m.service.startTerminalAttempt({companyId:1,staffId:7},'decline-doc',{operation:'payment',job_id:12,save_card:false});
  const intent=provider.intents[0];
  provider.charges.push({id:'ch_document',account:'acct_1',payment_intent:intent.id,metadata:{...intent.metadata},livemode:false,amount:22500,currency:'usd',status:'failed',paid:false,created:1790416800,
    failure_message:'Sensitive internal failure diagnostics',payment_method_details:{type:'card_present',card_present:{brand:'visa',last4:'0341',receipt:{application_preferred_name:'VISA\n\u202e',dedicated_file_name:'A0000000031010'}}}});
  await m.service.reconcileTerminalAttempt(1,a.attempt_id);
  const observation=db.sqlite.prepare("SELECT id FROM terminal_outcomes WHERE kind='declined'").get();
  return {a,id:observation.id};
}
test('declined document is explicit, sanitized and creates no financial or email effects',async()=>{
  const {a,id}=await decline();
  const document=await m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,id);
  assert.equal(document.filename,'declined-transaction.txt');
  assert.match(document.text,/Declined transaction — not proof of payment/);
  assert.match(document.text,/USD 225\.00/);assert.match(document.text,/0341/);assert.match(document.text,/ch_document/);
  assert.doesNotMatch(document.text,/Sensitive internal|\u202e|secret|cus_test/);
  assert.equal(provider.updates.length,0);assert.equal(provider.creates.length,1);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM stripe_payment_methods').get().n,0);
});
test('a later successful payment does not rewrite the declined tap document',async()=>{
  const {a,id}=await decline();const first=await m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,id);
  provider.intents[0].status='succeeded';await m.service.reconcileTerminalAttempt(1,a.attempt_id);
  const second=await m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,id);
  assert.equal(first.text,second.text);assert.match(second.text,/historical tap/i);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);
});
test('declined documents reverify tenant, connected account, mode and individual Charge on every view',async()=>{
  const {a,id}=await decline();
  await assert.rejects(m.declinedDocuments.getDeclinedTerminalDocument(2,a.attempt_id,id));
  provider.charges[0].paid=true;await assert.rejects(m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,id));
  provider.charges[0].paid=false;provider.charges[0].livemode=true;await assert.rejects(m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,id));
  provider.charges[0].livemode=false;db.sqlite.exec("UPDATE company SET stripe_account_id='acct_changed' WHERE id=1");
  await assert.rejects(m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,id));
});
test('timeout or save-only error without a verified failed payment has no document',async()=>{
  const a=await m.service.startTerminalAttempt({companyId:1,staffId:7},'unknown',{operation:'setup',customer_id:90,consent:{accepted:true,version:'terminal-save-v1',customer_name:'Ada'}});
  await assert.rejects(m.declinedDocuments.getDeclinedTerminalDocument(1,a.attempt_id,'not-an-outcome'));
});
