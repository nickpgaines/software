import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore production hooks and handlers, external browser/HTTP boundaries only
import {loadCustomerModule,hookRenderer,elements,text} from './helpers/customer-ui.mjs';
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const notice={id:'notice-one',attempt_id:'attempt-original',job_id:12,customer_id:90,kind:'declined',occurred_at:'2026-09-26T12:00:00Z',current_attempt_unresolved:true,summary:{amount_cents:22500,currency:'usd',operation:'payment'}};
async function harness(t:any,options:any={}) {
  const originals=['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const document=Object.assign(new EventTarget(),{visibilityState:options.hidden?'hidden':'visible'});
  Object.assign(globalThis,{window:new EventTarget(),document});
  const requests:any[]=[];const native=options.native??{generation:0};
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{requests.push({url,method:init?.method??'GET'});if(options.fetch)return options.fetch(url,init);return Response.json(init?.method==='POST'?{acknowledged:true}:{notices:[notice]});});
  const {default:Notices}=await loadCustomerModule('components/payments/TerminalNotices.tsx');
  const renderer=hookRenderer();t.after(()=>{renderer.dispose();for(const [key,value] of originals)value?Object.defineProperty(globalThis,key as string,value):Reflect.deleteProperty(globalThis,key as string);});
  let tree:any;const render=()=>{tree=renderer.render(Notices,{identityKey:'staff:7',native});renderer.flushEffects();return tree;};
  render();await settle();render();return{render,native,document,requests,get tree(){return tree;}};
}
test('hidden mount neither displays nor acknowledges a notice; visible explicit action acknowledges only its ID',async t=>{
  const h=await harness(t,{hidden:true});assert.equal(h.requests.length,0);
  h.document.visibilityState='visible';h.document.dispatchEvent(new Event('visibilitychange'));await settle();h.render();
  assert.match(text(h.tree),/declined/i);assert.match(text(h.tree),/Check payment status/);
  assert.equal(h.requests.some((r:any)=>r.method==='POST'),false);
  const link=elements(h.tree,(el:any)=>el.type==='a')[0];assert.equal(link.props.href,'/schedule/12?terminalAttempt=attempt-original');
  await elements(h.tree,(el:any)=>text(el)==='Dismiss notice')[0].props.onClick();h.render();
  assert.equal(h.requests.filter((r:any)=>r.method==='POST').length,1);assert.match(h.requests.at(-1).url,/notice-one\/ack$/);
  assert.doesNotMatch(text(h.tree),/This tap was declined/);
});
test('stale response after session reset cannot display another users payment notice',async t=>{
  let finish!:(r:Response)=>void;const h=await harness(t,{fetch:()=>new Promise(resolve=>{finish=resolve;})});
  h.native.generation++;finish(Response.json({notices:[notice]}));await settle();h.render();
  assert.doesNotMatch(text(h.tree),/declined|225/);
});
test('offline response does not claim a payment outcome',async t=>{
  const h=await harness(t,{fetch:async()=>{throw Error('offline');}});
  assert.match(text(h.tree),/unavailable|could not/i);assert.doesNotMatch(text(h.tree),/Payment confirmed/);
});
for(const change of ['rollout','missing-location','location'])test(`reader ${change} invalidation preserves mounted notices and original recovery identity`,async t=>{
  let enabled=true,location:string|null='tml_original';
  const native:any={generation:0,active:false,capabilities:async()=>({supported:true,warmupSupported:true,preparationSupported:true}),
    warmUp:async()=>({state:'ready'}),reset:async()=>{native.generation++;},suspend:async()=>{}};
  const {TerminalReadinessController}=await loadCustomerModule('lib/terminal-readiness.ts');
  const controller=new TerminalReadinessController(native,async(url:string)=>Response.json(url.endsWith('/capabilities')?{enabled}:url.endsWith('/company')?{id:1,stripe_account_id:'acct_1'}:{stripe_account:'acct_1',selected_location_id:location}));
  await controller.refresh();assert.equal(controller.state,'ready');
  const h=await harness(t,{native});const originalGeneration=native.generation;
  if(change==='rollout')enabled=false;else location=change==='location'?'tml_new':null;
  await controller.refresh();
  assert.equal(native.generation,originalGeneration,'reader invalidation is not an authenticated logout');
  window.dispatchEvent(new Event('focus'));await settle();h.render();
  assert.equal(h.requests.filter((r:any)=>r.method==='GET').length,2);
  assert.equal(elements(h.tree,(el:any)=>el.type==='a')[0].props.href,'/schedule/12?terminalAttempt=attempt-original');
});
