import assert from 'node:assert/strict';
import test from 'node:test';
import {loadCustomerModule,hookRenderer,elements,text} from './helpers/customer-ui.mjs';

const settle=async()=>{for(let i=0;i<16;i++)await new Promise(setImmediate);};
const summary={attempt_id:'paid_1',amount_cents:22500,created_at:'2026-09-26 12:00:00'};
const receipt={attempt_id:'paid_1',amount_cents:22500,refunded_cents:0,created:1790000000,receipt_url:'https://pay.stripe.com/receipts/payment/fake',test_mode:false};
async function harness(t:any,options:any={}) {
  const {default:Panel}=await loadCustomerModule('components/payments/TerminalReceipts.tsx');
  const renderer=hookRenderer();let tree:any;const calls:any[]=[];
  const props={jobId:12,native:{generation:0},...options.props};
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
    calls.push({url:String(url),method:init?.method||'GET',body:init?.body?JSON.parse(init.body):null});
    if(url==='/api/settings/company')return Response.json(options.company?.()??{id:1,stripe_account_id:'acct_1'});
    if(String(url).includes('?job_id='))return Response.json({receipts:options.rows??[summary]});
    if(init?.method==='POST')return options.send?options.send():Response.json({status:options.result??'requested'});
    if(options.get)return options.get(String(url));
    return Response.json({...receipt,...options.receipt,attempt_id:String(url).split('/').at(-2)});
  });
  const render=()=>{tree=renderer.render(Panel,props);renderer.flushEffects();return tree;};
  const button=(label:string)=>elements(tree,(e:any)=>e.type?.displayName==='Button'&&text(e).includes(label))[0];
  const input=()=>elements(tree,(e:any)=>e.type?.displayName==='Input')[0];
  render();await settle();render();t.after(()=>renderer.dispose());
  return{props,render,button,input,calls,renderer,get tree(){return tree;}};
}
test('empty receipt history is invisible and does not consult a reader',async t=>{
  const h=await harness(t,{rows:[]});assert.equal(h.tree,null);assert.equal(h.calls.some(c=>c.method==='POST'),false);
  assert.ok(h.calls.every(c=>c.url==='/api/settings/company'||c.url.includes('/receipts?')));
});
test('reopened checkout shows previous receipt without native capabilities and permits explicit email',async t=>{
  const h=await harness(t);assert.match(text(h.tree),/225\.00/);assert.ok(h.input());
  assert.equal(h.button('Email receipt').props.disabled,true);
  h.input().props.onChange({target:{value:'guest@example.com'}});h.render();
  await h.button('Email receipt').props.onClick();h.render();
  assert.match(text(h.tree),/requested/i);assert.doesNotMatch(text(h.tree),/delivered/i);
  assert.deepEqual(h.calls.filter(c=>c.method==='POST').map(c=>c.body),[{email:'guest@example.com'}]);
});
test('latest confirmed attempt is selected ahead of older receipts',async t=>{
  const h=await harness(t,{rows:[summary,{...summary,attempt_id:'paid_2'}],props:{latestAttemptId:'paid_2'}});
  assert.ok(h.calls.some(c=>c.url.endsWith('/paid_2/receipt')));
});
test('test receipt explains no automatic email and shows refunded amount',async t=>{
  const h=await harness(t,{receipt:{test_mode:true,refunded_cents:500},result:'test_only'});
  h.input().props.onChange({target:{value:'fake@example.com'}});h.render();await h.button('Email receipt').props.onClick();h.render();
  assert.match(text(h.tree),/test/i);assert.match(text(h.tree),/not.*automatically|no.*email/i);assert.match(text(h.tree),/5\.00/);
});
test('receipt failure preserves input and financial confirmation, never calls collection or reconciliation',async t=>{
  const h=await harness(t,{send:async()=>Response.json({error:'Receipt service unavailable. Do not collect payment again.'},{status:503})});
  h.input().props.onChange({target:{value:'guest@example.com'}});h.render();await h.button('Email receipt').props.onClick();h.render();
  assert.equal(h.input().props.value,'guest@example.com');assert.match(text(h.tree),/Do not collect/i);
  assert.ok(h.calls.every(c=>!c.url.endsWith('/reconcile')&&!c.url.endsWith('/cancel')));
});
test('synchronous double click submits one receipt request',async t=>{
  let finish:any;const h=await harness(t,{send:()=>new Promise(resolve=>{finish=()=>resolve(Response.json({status:'requested'}));})});
  h.input().props.onChange({target:{value:'guest@example.com'}});h.render();const click=h.button('Email receipt').props.onClick;
  const first=click();const second=click();await settle();finish();await Promise.all([first,second]);
  assert.equal(h.calls.filter(c=>c.method==='POST').length,1);
});
test('selection rejects a mismatched receipt response and offers retry',async t=>{
  const h=await harness(t,{get:async()=>Response.json({...receipt,attempt_id:'someone_else'})});
  assert.equal(h.input(),undefined);assert.ok(h.button('Retry receipt'));assert.equal(h.button('Email receipt'),undefined);
});
test('lookup failure can be retried without initiating another payment',async t=>{
  let fail=true;const h=await harness(t,{get:async()=>fail?Response.json({error:'Receipt unavailable'},{status:503}):Response.json(receipt)});
  assert.ok(h.button('Retry receipt'));fail=false;await h.button('Retry receipt').props.onClick();h.render();assert.ok(h.input());
  assert.equal(h.calls.some(c=>c.method==='POST'),false);
});
test('unsafe receipt URL never becomes an external link',async t=>{
  const h=await harness(t,{receipt:{receipt_url:'https://evil.example/receipt'}});
  assert.equal(elements(h.tree,(e:any)=>e.type==='a').length,0);
});
test('account switch before send clears stale receipt and makes no request',async t=>{
  let company={id:1,stripe_account_id:'acct_1'};const h=await harness(t,{company:()=>company});
  h.input().props.onChange({target:{value:'guest@example.com'}});h.render();company={id:2,stripe_account_id:'acct_2'};
  await h.button('Email receipt').props.onClick();h.render();assert.equal(h.calls.some(c=>c.method==='POST'),false);assert.equal(h.input(),undefined);
});
for(const change of ['unmount','generation','job'])test(`pending receipt lookup is ignored after ${change}`,async t=>{
  let finish:any;const h=await harness(t,{get:()=>new Promise(resolve=>{finish=()=>resolve(Response.json(receipt));})});
  if(change==='unmount')h.renderer.dispose();
  if(change==='generation')h.props.native.generation++;
  if(change==='job'){h.props.jobId=13;h.render();}
  finish();await settle();h.render();assert.equal(h.input(),undefined);
});
test('late older receipt selection cannot overwrite current selection',async t=>{
  let finish:any;const h=await harness(t,{rows:[summary,{...summary,attempt_id:'paid_2'}],get:(url:string)=>url.includes('paid_1')?new Promise(resolve=>{finish=()=>resolve(Response.json(receipt));}):Response.json({...receipt,attempt_id:'paid_2',amount_cents:5000})});
  const choices=elements(h.tree,(e:any)=>e.type?.displayName==='Button'&&e.props['aria-pressed']!==undefined);
  const first=choices[0].props.onClick();await settle();await choices[1].props.onClick();finish();await first;h.render();
  assert.match(text(h.tree),/50\.00/);assert.equal(elements(h.tree,(e:any)=>e.type==='a')[0].props.href,receipt.receipt_url);
});
