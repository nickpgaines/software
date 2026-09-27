import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,provider} from './helpers/terminal-harness.mjs';
import {setSession} from './helpers/terminal-harness.mjs';
const m=await loadTerminal({notices:true});let db:ReturnType<typeof fixture>;
const auth={companyId:1,staffId:7};
beforeEach(async()=>{process.env.TAP_TO_PAY_ENABLED='true';db=fixture();await m.schema.installTerminalSchema(db.db);});
afterEach(()=>{db.close();delete process.env.TAP_TO_PAY_ENABLED;});
const start=()=>m.service.startTerminalAttempt(auth,'notices',{operation:'payment',job_id:12,save_card:false});
test('private notices require current initiating staff and matching company/account',async()=>{
  await start();
  assert.equal((await m.outcomes.listTerminalNotices(auth)).notices.length,1);
  for(const principal of [{companyId:1,staffId:8},{companyId:2,staffId:7},{companyId:1,staffId:null}])assert.equal((await m.outcomes.listTerminalNotices(principal)).notices.length,0);
  db.sqlite.exec("UPDATE company SET stripe_account_id='acct_changed' WHERE id=1");
  assert.equal((await m.outcomes.listTerminalNotices(auth)).notices.length,0);
});
test('acknowledgment survives retries without resolving money or suppressing a later transition',async()=>{
  const a=await start();const original=(await m.outcomes.listTerminalNotices(auth)).notices[0];
  await assert.rejects(m.outcomes.acknowledgeTerminalNotice({companyId:1,staffId:8},original.id));
  await m.outcomes.acknowledgeTerminalNotice(auth,original.id);await m.outcomes.acknowledgeTerminalNotice(auth,original.id);
  assert.equal((await m.outcomes.listTerminalNotices(auth)).notices.length,0);
  assert.equal(db.sqlite.prepare('SELECT status FROM terminal_attempts').get().status,'ready');
  provider.intents[0].status='processing';await m.service.reconcileTerminalAttempt(1,a.attempt_id);
  await m.outcomes.acknowledgeTerminalNotice(auth,original.id);
  const next=(await m.outcomes.listTerminalNotices(auth)).notices;
  assert.equal(next.length,1);assert.notEqual(next[0].id,original.id);
  process.env.TAP_TO_PAY_ENABLED='false';provider.failLookup=true;
  assert.equal((await m.outcomes.listTerminalNotices(auth)).notices.length,1);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,0);
});
test('provider-free original-attempt read cannot select another job or leak secrets',async()=>{
  const a=await start();provider.failLookup=true;process.env.TAP_TO_PAY_ENABLED='false';
  const result=await m.service.listTerminalAttempts(1,{job_id:12,attempt_id:a.attempt_id});
  assert.equal(result.attempts[0].attempt_id,a.attempt_id);assert.equal(result.attempts[0].client_secret,undefined);
  await assert.rejects(m.service.listTerminalAttempts(1,{job_id:13,attempt_id:a.attempt_id}));
  await assert.rejects(m.service.listTerminalAttempts(2,{job_id:12,attempt_id:a.attempt_id}));
});
test('notice routes are private and provider-free while cross-origin acknowledgment is rejected',async()=>{
  await start();const notice=(await m.outcomes.listTerminalNotices(auth)).notices[0];
  const url='https://www.forgecrm.app/api/stripe/terminal/notices';
  process.env.TAP_TO_PAY_MODE='invalid';process.env.TAP_TO_PAY_ENABLED='false';
  const response=await m.notices.GET(new Request(url,{headers:{'X-Forge-Terminal-Mode':'invalid'}}));
  assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control')!,/private.*no-store/);
  const ack=(origin:string)=>m.noticeAck.POST(new Request(`${url}/${notice.id}/ack`,{method:'POST',headers:{Origin:origin,'X-Forge-Terminal-Mode':'invalid'}}),{params:{id:notice.id}});
  assert.equal((await ack('https://other.invalid')).status,403);
  assert.equal((await ack('https://www.forgecrm.app')).status,200);
  setSession(null);assert.equal((await m.notices.GET(new Request(url))).status,401);
});
