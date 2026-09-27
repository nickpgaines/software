import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore actual production hooks/handlers with external HTTP/native boundary fakes
import {loadCustomerModule,hookRenderer,elements,text} from './helpers/customer-ui.mjs';
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
async function harness(t:any,options:any={}) {
  const {default:Panel}=await loadCustomerModule('components/payments/TerminalDeclinedReceipts.tsx');
  const renderer=hookRenderer();t.after(()=>renderer.dispose());let tree:any;let shares=0;
  const native={generation:0,shareDeclinedDocument:async()=>{shares++;if(options.share)return options.share();return{status:'canceled'};}};
  const requests:any[]=[];
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
    requests.push({url,method:init?.method??'GET'});
    if(url==='/api/settings/company')return Response.json({id:1,stripe_account_id:'acct_1'});
    if(String(url).includes('?job_id'))return Response.json({declines:[{id:'decline_1',attempt_id:'original',amount_cents:22500,occurred_at:'2026-09-26T12:00:00Z'}]});
    if(options.document)return options.document();
    return Response.json({filename:'declined-transaction.txt',text:'Declined transaction — not proof of payment\nUSD 225.00'});
  });
  const render=()=>{tree=renderer.render(Panel,{jobId:12,native});renderer.flushEffects();return tree;};
  render();await settle();render();
  const button=()=>elements(tree,(el:any)=>el.type?.displayName==='Button'&&text(el).includes('Share declined'))[0];
  return{render,button,native,requests,get shares(){return shares;},get tree(){return tree;}};
}
test('canceled sharing leaves document available and never claims delivery or changes payment',async t=>{
  const h=await harness(t);await h.button().props.onClick();h.render();
  assert.equal(h.shares,1);assert.match(text(h.tree),/canceled/i);assert.doesNotMatch(text(h.tree),/delivered|email sent/i);
  assert.ok(h.button());assert.equal(h.requests.some((r:any)=>r.method!=='GET'),false);
});
test('logout during document lookup prevents private data from reaching activity sheet',async t=>{
  let finish!:(r:Response)=>void;const h=await harness(t,{document:()=>new Promise(resolve=>{finish=resolve;})});
  const work=h.button().props.onClick();await settle();h.native.generation++;
  finish(Response.json({filename:'declined-transaction.txt',text:'private historical tap'}));await work;h.render();assert.equal(h.shares,0);
});
test('activity failure retains retry without advising another payment',async t=>{
  const h=await harness(t,{share:async()=>{throw Error('unavailable');}});await h.button().props.onClick();h.render();
  assert.match(text(h.tree),/retry|unavailable/i);assert.match(text(h.tree),/Do not collect/i);assert.ok(h.button());
});
