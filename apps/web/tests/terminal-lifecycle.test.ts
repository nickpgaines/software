import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore Hook loader only replaces external imports; controller stays real.
import {loadCustomerModule} from './helpers/customer-ui.mjs';

async function fixture(options:any={}) {
  const {TerminalReadinessController}=await loadCustomerModule('lib/terminal-readiness.ts');
  let generation=0; let company=1; const warms:any[]=[]; const requests:string[]=[]; let resets=0;let offline=false;
  const native={get generation(){return generation;},active:false,
    capabilities:async()=>({supported:true,preparationSupported:true,warmupSupported:true,providerMode:'test',...options.capability}),
    warmUp:async(args:any)=>{warms.push(args);await options.warm?.();return {state:'ready'};},
    reset:async()=>{resets++;generation++;},suspend:async()=>{resets++;}};
  const fetcher=async(url:string)=>{
    requests.push(url);
    if(offline)throw Error('offline');
    if(url.endsWith('/capabilities'))return Response.json({enabled:options.enabled??true});
    if(url==='/api/settings/company')return Response.json({id:company,stripe_account_id:`acct_${company}`});
    if(url.endsWith('/location'))return Response.json({stripe_account:`acct_${company}`,selected_location_id:options.missingLocation?null:'tml_1'});
    throw Error(url);
  };
  const controller=new TerminalReadinessController(native,fetcher);
  return {controller,native,warms,requests,offline:()=>{offline=true;},logout:()=>{generation++;},switchCompany:()=>{company=2;},get resets(){return resets;}};
}
test('foreground duplicates share one automatic warmup with no payment calls',async()=>{
  const h=await fixture();
  await Promise.all([h.controller.refresh(),h.controller.refresh()]);
  assert.equal(h.warms.length,1);assert.equal(h.controller.state,'ready');
  assert.equal(h.requests.some(url=>/attempts|intent/.test(url)),false);
});
for(const options of [{enabled:false},{capability:{supported:false}},{capability:{warmupSupported:false}},{missingLocation:true}]) {
  test(`automatic warmup skips unavailable environment ${JSON.stringify(options)}`,async()=>{
    const h=await fixture(options);await h.controller.refresh();assert.equal(h.warms.length,0);assert.notEqual(h.controller.state,'ready');
  });
}
test('logout or background during warmup cannot restore stale readiness',async()=>{
  for(const action of ['logout','background']) {
    let finish!:()=>void;
    const h=await fixture({warm:()=>new Promise<void>(resolve=>{finish=resolve;})});
    const work=h.controller.refresh();await new Promise(resolve=>setImmediate(resolve));
    if(action==='logout')h.logout();else await h.controller.suspend();
    finish();await work;assert.notEqual(h.controller.state,'ready');
    if(action==='background'){const count=h.requests.length;await h.controller.refresh();assert.equal(h.requests.length,count);}
  }
});
test('changed company clears reader before preparing new identity',async()=>{
  const h=await fixture();await h.controller.refresh();h.switchCompany();await h.controller.refresh();
  assert.equal(h.resets,1);assert.equal(h.warms.at(-1).stripeAccount,'acct_2');
});
test('busy collection prevents automatic warmup and resets',async()=>{
  const h=await fixture();h.native.active=true;await h.controller.refresh();
  assert.equal(h.warms.length,0);assert.equal(h.resets,0);
});
test('failed fresh eligibility check revokes an idle reader instead of trusting cached ready',async()=>{
  const h=await fixture();await h.controller.refresh();h.offline();await h.controller.refresh();
  assert.equal(h.resets,1);assert.equal(h.controller.state,'unavailable');
});
