import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore existing UI harness executes the production hooks and JSX handlers.
import {loadCustomerModule, hookRenderer, elements, text} from './helpers/customer-ui.mjs';

const settle = async () => { for(let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve)); };
const ready = {attempt_id:'attempt_1',operation:'payment',status:'ready',stripe_account:'acct_1',terminal_location_id:'tml_1',client_secret:'ephemeral',amount_cents:5000,customer_id:2,job_id:1,save_card:false,payment_recorded:false,card_saved:false,warning:null};

async function harness(t: any, options: any = {}) {
  const {default: Flow} = await loadCustomerModule('components/payments/TerminalFlow.tsx');
  const renderer = hookRenderer();
  const calls: {url:string; body:any}[]=[];
  let current = {...ready,...options.attempt};
  let created = false;
  const native = {generation:0, capabilities: async()=>({supported:options.supported ?? true}), education:async()=>{}, cancel:async(_id?:string)=>{}, collect:async(_operation?:string)=>{if(options.collect) return options.collect();}};
  t.mock.method(globalThis,'fetch',async (url:any,init:any)=> {
    calls.push({url:String(url),body:init?.body ? JSON.parse(init.body):null});
    if(url==='/api/settings/company') return Response.json(options.merchant?.() ?? {id:1,name:'Acme',stripe_account_id:'acct_1'});
    if(String(url).includes('?')) return Response.json({attempts:options.list ?? (created ? [current]:[])});
    if(url==='/api/stripe/terminal/attempts') {created=true; if(options.createError) throw Error('lost response'); return Response.json(current);}
    if(String(url).endsWith('/reconcile')) {current={...current,...(options.reconciled ?? {status:'succeeded',payment_recorded:true})};return Response.json(current);}
    if(String(url).endsWith('/cancel')) {current={...current,...(options.canceled ?? {status:'canceled'})};return Response.json(current);}
    throw Error(`Unexpected ${url}`);
  });
  const completed:any[]=[]; const blocked:boolean[]=[];
  const props={operation:'payment',jobId:1,native,onSuccess:(a:any)=>completed.push(a),onBlockedChange:(b:boolean)=>blocked.push(b),...options.props};
  let tree:any;
  const render=()=>{tree=renderer.render(Flow,props);renderer.flushEffects();return tree;};
  const button=(label:string)=>elements(tree,(el:any)=>el.type==='button'&&text(el).includes(label))[0];
  render(); await settle();render();
  t.after(()=>renderer.dispose());
  return {render,button,calls,completed,blocked,renderer,native,props,get tree(){return tree;}};
}

test('unsupported plugin disables tap with useful manual card fallback',async t=>{
  const h=await harness(t,{supported:false});
  assert.equal(h.button('Tap to Pay').props.disabled,true);
  assert.match(text(h.tree),/manual|Pay with card/i);
});
test('synchronous double tap creates once and payment save warning still reports verified success',async t=>{
  const h=await harness(t,{reconciled:{status:'succeeded',payment_recorded:true,card_saved:false,warning:'Card could not be saved'}});
  const action=h.button('Tap to Pay').props.onClick;
  await Promise.all([action(),action()]);h.render();
  assert.equal(h.calls.filter(c=>c.url==='/api/stripe/terminal/attempts').length,1);
  assert.equal(h.completed.length,1);assert.match(text(h.tree),/Card could not be saved/);
});
test('uncertain collection reconciles the original attempt without a second create',async t=>{
  const h=await harness(t,{collect:async()=>{throw Error('connection lost');},reconciled:{status:'processing'}});
  await h.button('Tap to Pay').props.onClick();h.render();
  assert.equal(h.blocked.at(-1),true);
  await h.button('Check status').props.onClick();h.render();
  assert.equal(h.calls.filter(c=>c.url.endsWith('attempt_1/reconcile')).length,2);
  assert.equal(h.calls.filter(c=>c.url==='/api/stripe/terminal/attempts').length,1);
  assert.equal(h.completed.length,0);
});
test('lost create response lists and reconciles before allowing another payment',async t=>{
  const h=await harness(t,{createError:true,reconciled:{status:'needs_reconciliation'}});
  await h.button('Tap to Pay').props.onClick();h.render();
  assert.equal(h.blocked.at(-1),true);
  assert.equal(h.calls.filter(c=>c.url.endsWith('attempt_1/reconcile')).length,1);
  assert.equal(h.button('Tap to Pay on iPhone'),undefined);
});
test('unmount prevents late native success from writing or refreshing',async t=>{
  let finish!:()=>void;
  const h=await harness(t,{collect:()=>new Promise<void>(resolve=>{finish=resolve;})});
  const work=h.button('Tap to Pay').props.onClick();await settle();
  h.renderer.dispose();finish();await work;
  assert.equal(h.completed.length,0);
  assert.equal(h.calls.filter(c=>c.url.endsWith('/reconcile')).length,0);
});
test('save-only captures customer consent and calls setup without charge or subscription',async t=>{
  const operations:string[]=[];
  const h=await harness(t,{attempt:{operation:'setup',job_id:null,save_card:true},reconciled:{status:'succeeded',payment_recorded:false,card_saved:true},props:{operation:'setup',customerId:2,jobId:undefined}});
  h.native.collect=async(operation?:string)=>{operations.push(operation!);};
  assert.equal(h.button('Save card with a tap').props.disabled,true);
  elements(h.tree,(el:any)=>el.type==='input'&&el.props.type==='text')[0].props.onChange({target:{value:'Jane Customer'}});
  elements(h.tree,(el:any)=>el.type==='input'&&el.props.type==='checkbox')[0].props.onChange({target:{checked:true}});
  h.render();await h.button('Save card with a tap').props.onClick();h.render();
  assert.deepEqual(operations,['setup']);
  assert.deepEqual(h.calls.find(c=>c.url==='/api/stripe/terminal/attempts')!.body,{operation:'setup',customer_id:2,consent:{accepted:true,version:'terminal-save-v1',customer_name:'Jane Customer'}});
  assert.equal(h.calls.some(c=>/charge|subscriptions/.test(c.url)),false);
  assert.equal(h.completed.length,1);
});

test('logout generation prevents native completion from reconciling in another session',async t=>{
  let finish!:()=>void;
  const h=await harness(t,{collect:()=>new Promise<void>(resolve=>{finish=resolve;})});
  const work=h.button('Tap to Pay').props.onClick();await settle();
  h.native.generation++;finish();await work;
  assert.equal(h.completed.length,0);
  assert.equal(h.calls.filter(c=>c.url.endsWith('/reconcile')).length,0);
});

test('subscription assignment requires acceptance/signature and explicitly sends saved row ID without activation',async t=>{
  const {SubscriptionCardAssignment}=await loadCustomerModule('components/payments/SavedCards.tsx');
  const renderer=hookRenderer();t.after(()=>renderer.dispose());
  const calls:any[]=[];
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
    calls.push({url,body:init?.body ? JSON.parse(init.body):null});
    if(!init?.method) return Response.json({payment_methods:[{id:9,brand:'visa',last4:'4242',recurring_only:1,requires_explicit_selection:1}]});
    return Response.json({id:3});
  });
  let refreshed=0;
  let props={subscription:{id:3,customer_id:2,accepted_at:null,require_signature:1,signature_data:null,status:'pending'},onChanged:()=>{refreshed++;}};
  const render=()=>{const tree=renderer.render(SubscriptionCardAssignment,props);renderer.flushEffects();return tree;};
  let tree=render();await settle();tree=render();
  assert.match(text(tree),/accepted and signed/i);
  props={...props,subscription:{...props.subscription,accepted_at:'2026-09-16',signature_data:'signed'}} as any;
  tree=render();
  const select=elements(tree,(el:any)=>el.type==='select')[0];
  assert.equal(select.props.value,'');
  assert.match(text(tree),/recurring.*off-session/i);
  select.props.onChange({target:{value:'9'}});tree=render();
  await elements(tree,(el:any)=>el.type==='button'&&text(el).includes('Use selected card'))[0].props.onClick();
  assert.deepEqual(calls.filter(c=>c.body),[{url:'/api/customer-subscriptions/3/payment-method',body:{payment_method_id:9}}]);
  assert.equal(refreshed,1);
});

test('account remapping during collection prevents reconciliation and success callbacks',async t=>{
  let finish!:()=>void;let account='acct_1';
  const h=await harness(t,{merchant:()=>({id:1,name:'Acme',stripe_account_id:account}),collect:()=>new Promise<void>(resolve=>{finish=resolve;})});
  const work=h.button('Tap to Pay').props.onClick();await settle();
  account='acct_2';finish();await work;h.render();
  assert.equal(h.completed.length,0);
  assert.equal(h.calls.filter(c=>c.url.endsWith('/reconcile')).length,0);
  assert.match(text(h.tree),/Account changed/);
});

test('job saved-card picker does not auto-select explicit-only cards or permit recurring-only wallets',async t=>{
  const {default:Modal}=await loadCustomerModule('components/jobs/RecordPaymentModal.tsx');
  const renderer=hookRenderer();t.after(()=>renderer.dispose());
  t.mock.method(globalThis,'fetch',async()=>Response.json({payment_methods:[{id:9,brand:'visa',last4:'4242',wallet_type:'apple_pay',is_default:0,recurring_only:1,requires_explicit_selection:1}]}));
  const props={jobId:1,customerId:2,jobTotalCents:5000,paidTotalCents:0,onClose(){},onRecorded(){}};
  let tree=renderer.render(Modal,props);renderer.flushEffects();await settle();tree=renderer.render(Modal,props);
  const wallet=elements(tree,(el:any)=>typeof el.props.onClick==='function'&&text(el).includes('4242'))[0];
  assert.equal(wallet.props.disabled,true);
  assert.match(text(tree),/recurring.*off-session/i);
});

test('new subscription explicitly includes chosen row only for acceptance, preserving manual no-card override',async t=>{
  (globalThis as any).__customerQuery='customer_id=2';t.after(()=>delete (globalThis as any).__customerQuery);
  const {default:Form}=await loadCustomerModule('components/NewSubscriptionForm.tsx');
  const renderer=hookRenderer();t.after(()=>renderer.dispose());
  const requests:any[]=[];
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
    if(init?.method){requests.push({url,body:init?.body ? JSON.parse(init.body):null});return Response.json({id:3});}
    if(url==='/api/customers')return Response.json([{id:2,name:'Jane'}]);
    if(url==='/api/settings/subscriptions')return Response.json([{id:4,name:'Plan',active:1,require_signature:0,service_interval:'monthly',price_cents:5000}]);
    if(String(url).includes('/payment-methods'))return Response.json({payment_methods:[{id:9,brand:'visa',last4:'4242',recurring_only:1}]});
    return Response.json([]);
  });
  const render=()=>{const tree=renderer.render(Form);renderer.flushEffects();return tree;};
  let tree=render();await settle();tree=render();
  elements(tree,(el:any)=>el.props.title==='Accept for customer')[0].props.onChange();
  elements(tree,(el:any)=>el.type==='select'&&text(el).includes('Plan'))[0].props.onChange({target:{value:'4'}});
  elements(tree,(el:any)=>el.props.placeholder==='249.00')[0].props.onChange({target:{value:'50'}});
  tree=render();
  const selector=elements(tree,(el:any)=>el.props['aria-label']==='Saved card for this subscription')[0];
  assert.equal(selector.props.value,'');selector.props.onChange({target:{value:'9'}});tree=render();
  const submit=()=>elements(tree,(el:any)=>typeof el.props.onClick==='function'&&text(el).includes('Create Subscription'))[0];
  await submit().props.onClick();
  assert.equal(requests[0].body.payment_method_id,9);
  assert.equal(requests.length,1);
  tree=render();elements(tree,(el:any)=>el.type==='input'&&el.props.type==='checkbox')[0].props.onChange({target:{checked:true}});tree=render();
  await submit().props.onClick();
  assert.equal('payment_method_id' in requests[1].body,false);
  assert.equal(requests[2].url,'/api/customer-subscriptions/3/activate');
});

test('ambiguous creation with empty recovery listing does not allow another payment',async t=>{
  const h=await harness(t,{createError:true,list:[]});
  await h.button('Tap to Pay').props.onClick();h.render();
  assert.equal(h.blocked.at(-1),true);
  assert.equal(h.button('Tap to Pay').props.disabled,true);
});

test('dismissed attempt stores only its ID and reload reconciles it even after it leaves the active list',async t=>{
  const values=new Map<string,string>();
  const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else Reflect.deleteProperty(globalThis,'sessionStorage');});
  const first=await harness(t,{collect:async()=>{throw Error('lost');},reconciled:{status:'processing'}});
  await first.button('Tap to Pay').props.onClick();first.renderer.dispose();
  assert.deepEqual([...values.values()],['attempt_1']);
  const second=await harness(t,{list:[],reconciled:{status:'succeeded',payment_recorded:true}});
  assert.equal(second.calls.filter(c=>c.url.endsWith('attempt_1/reconcile')).length,1);
  assert.equal(second.completed.length,1);
  assert.equal(second.calls.filter(c=>c.url==='/api/stripe/terminal/attempts').length,0);
  assert.equal(values.size,0);
});

test('cancel race reconciles successful payment instead of enabling a second payment',async t=>{
  const h=await harness(t,{collect:async()=>{throw Error('lost');},reconciled:{status:'processing'},canceled:{status:'succeeded',payment_recorded:true}});
  await h.button('Tap to Pay').props.onClick();h.render();
  await h.button('Cancel attempt').props.onClick();h.render();
  assert.equal(h.completed.length,1);
  assert.match(text(h.tree),/Payment confirmed/);
  assert.equal(h.button('Tap to Pay on iPhone'),undefined);
});

test('checkout blocks manual switches synchronously and refreshes only on verified Terminal success',async t=>{
  const {default:Checkout}=await loadCustomerModule('components/jobs/CheckoutModal.tsx');
  const renderer=hookRenderer();t.after(()=>renderer.dispose());
  const choices:string[]=[];let paid=0;
  const props={jobId:1,jobTotalCents:5000,paidTotalCents:0,onClose(){},onChoose:(choice:string)=>choices.push(choice),onPaid:()=>{paid++;}};
  let tree=renderer.render(Checkout,props);
  const flow=elements(tree,(el:any)=>el.props.operation==='payment')[0];
  const manual=elements(tree,(el:any)=>typeof el.props.onClick==='function'&&text(el)==='Pay with card')[0];
  assert.equal(manual.props.disabled,true);
  flow.props.onBlockedChange(false);manual.props.onClick();assert.deepEqual(choices,['card']);
  flow.props.onBlockedChange(true);manual.props.onClick();assert.deepEqual(choices,['card']);
  assert.equal(paid,0);
  flow.props.onSuccess({...ready,status:'succeeded',payment_recorded:true});
  assert.equal(paid,1);
  tree=renderer.render(Checkout,props);
  assert.equal(elements(tree,(el:any)=>typeof el.props.onClick==='function'&&text(el)==='Pay with card')[0].props.disabled,true);
});
