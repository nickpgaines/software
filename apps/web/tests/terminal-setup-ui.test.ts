import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore Production component hooks and handlers, with external network/device boundaries replaced.
import {loadCustomerModule, hookRenderer, elements, text} from './helpers/customer-ui.mjs';

const settle = async () => { for (let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve)); };
const location = {id:'tml_1',display_name:'Main office',address:{line1:'123 Main St',city:'Charleston',state:'SC',postal_code:'29401',country:'US'}};
async function harness(t:any, options:any={}) {
  const {default:Setup} = await loadCustomerModule('components/payments/TerminalSetup.tsx');
  const renderer=hookRenderer({contextValue:options.readiness?{state:options.readiness,refresh:async()=>{}}:undefined});
  const requests:any[]=[]; const preparations:any[]=[]; const cancellations:any[]=[];
  let account='acct_1'; let progress:((event:any)=>void)|undefined;
  let data={stripe_account:account,can_manage:true,locations:[location],selected_location_id:'tml_1',has_more:false,...options.data};
  const native={generation:0,capabilities:async()=>({supported:true,preparationSupported:true,...options.capabilities}),
    education:async()=>{},cancel:async(...args:any[])=>{cancellations.push(args);},
    prepare:async(args:any,lease:any,callback:any)=>{preparations.push(args);progress=callback;await options.prepare?.();}};
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
    requests.push({url,method:init?.method,headers:new Headers(init?.headers),body:init?.body?JSON.parse(init.body):null});
    if(url==='/api/stripe/terminal/capabilities') return Response.json({enabled:options.enabled??true});
    if(url==='/api/settings/company') return Response.json({id:1,name:'Acme',stripe_account_id:account});
    if(url==='/api/stripe/terminal/location') {
      if(options.locationError) return Response.json({error:'Complete Stripe onboarding before setting up Tap to Pay.'},{status:409});
      if(init?.method==='POST') {
        const body=JSON.parse(init.body); data={...data,selected_location_id:body.location_id??'tml_new',locations:body.location_id?data.locations:[{id:'tml_new',...body}]};
        return Response.json({location_id:data.selected_location_id,stripe_account:account,display_name:'Main office'});
      }
      return Response.json({...data,stripe_account:account});
    }
    throw Error(`Unexpected request ${url}`);
  });
  let tree:any; const props={native,accountKey:'acct_1'};
  const render=()=>{tree=renderer.render(Setup,props);renderer.flushEffects();return tree;};
  const button=(label:string)=>elements(tree,(el:any)=>el.type?.displayName==='Button'&&text(el).includes(label))[0];
  const input=(label:string)=>elements(tree,(el:any)=>el.props['aria-label']===label)[0];
  render();const initial=tree;await settle();render();t.after(()=>renderer.dispose());
  return {render,button,input,props,native,requests,preparations,cancellations,renderer,initial,
    changeAccount:()=>{account='acct_2';},progress:(message:string)=>progress?.({operationId:preparations.at(-1)?.operationId,phase:'configuring',message,progress:0.5}),get tree(){return tree;}};
}

test('setup checks readiness without preparing a device or creating a location on mount',async t=>{
  const h=await harness(t);
  assert.match(text(h.initial),/checking/i);
  assert.match(text(h.tree),/Main office/);
  assert.equal(h.requests.some(r=>r.method==='POST'),false);
  assert.equal(h.preparations.length,0);
  assert.ok(h.button('How to tap'));
});
test('Payments distinguishes authorized setup needed from temporary reader unavailability',async t=>{
  const h=await harness(t,{readiness:'setupRequired'});
  assert.match(text(h.tree),/authorized administrator.*finish.*setup/i);
  assert.equal(h.preparations.length,0);
});
test('test app setup sends test mode on every Terminal request including location writes',async t=>{
  const h=await harness(t,{capabilities:{providerMode:'test'},data:{selected_location_id:null,locations:[location]}});
  elements(h.tree,(el:any)=>el.type==='select')[0].props.onChange({target:{value:'tml_1'}});h.render();
  await h.button('Save location').props.onClick();h.render();
  assert.ok(h.requests.some(r=>r.method==='POST'));
  assert.ok(h.requests.filter(r=>r.url.startsWith('/api/stripe/terminal/')).every(r=>r.headers.get('X-Forge-Terminal-Mode')==='test'));
});
test('staff Payments tab exposes preparation without exposing Connect management',async t=>{
  const {default:Tabs}=await loadCustomerModule('components/SettingsTabs.tsx');
  (globalThis as any).__customerQuery='tab=payments';t.after(()=>delete (globalThis as any).__customerQuery);
  const outer=hookRenderer();const inner=hookRenderer();t.after(()=>{outer.dispose();inner.dispose();});
  const wrapper=outer.render(Tabs,{username:'staff',initialMe:{is_admin_account:false,permissions:[]}});
  const child=wrapper.props.children;
  const tree=inner.render(child.type,child.props);inner.flushEffects();
  assert.ok(elements(tree,(el:any)=>el.type?.displayName==='Button' && text(el)==='Payments')[0]);
  assert.ok(elements(tree,(el:any)=>el.type?.name==='TerminalSetup')[0]);
  assert.equal(elements(tree,(el:any)=>el.type?.name==='PaymentsPanel').length,0);
});
test('ordinary staff can prepare but cannot opt into merchant terms or change the location',async t=>{
  const h=await harness(t,{data:{can_manage:false}});
  assert.match(text(h.tree),/administrator/i);
  assert.equal(elements(h.tree,(el:any)=>el.type?.displayName==='Checkbox').length,0);
  assert.equal(h.button('Save location'),undefined);
  assert.ok(h.button('Prepare this iPhone'));
  await h.button('Prepare this iPhone').props.onClick();h.render();
  assert.equal(h.preparations[0].representativeConfirmed,false);
  assert.match(text(h.tree),/ready.*iPhone|iPhone.*ready/i);
});
test('authorized staff must explicitly confirm representative authority before permitting terms',async t=>{
  const h=await harness(t);
  const check=elements(h.tree,(el:any)=>el.type?.displayName==='Checkbox')[0];
  assert.ok(check);assert.equal(check.props.checked,false);
  check.props.onCheckedChange(true);h.render();
  await h.button('Prepare this iPhone').props.onClick();h.render();
  assert.equal(h.preparations[0].representativeConfirmed,true);
  assert.equal(h.preparations[0].stripeAccount,'acct_1');
  assert.equal(h.preparations[0].locationId,'tml_1');
  assert.equal(h.requests.some(r=>/attempts|intent|subscriptions/.test(r.url)),false);
});
for (const options of [{enabled:false},{capabilities:{supported:false}},{capabilities:{preparationSupported:false}},{locationError:true}]) {
  test(`setup is unavailable with useful fallback: ${JSON.stringify(options)}`,async t=>{
    const h=await harness(t,options);
    assert.match(text(h.tree),/coming soon|supported.*iPhone|update Forge|onboarding/i);
    assert.match(text(h.tree),/Pay with card/i);
    assert.ok(!h.button('Prepare this iPhone') || h.button('Prepare this iPhone').props.disabled);
    assert.equal(h.preparations.length,0);
  });
}
test('multiple locations require explicit selection and save before preparation',async t=>{
  const h=await harness(t,{data:{selected_location_id:null,has_more:true,locations:[location,{...location,id:'tml_2',display_name:'Branch office'}]}});
  assert.ok(h.button('Prepare this iPhone').props.disabled);
  assert.match(text(h.tree),/more locations/i);
  h.input('Business location').props.onChange({target:{value:'tml_2'}});h.render();
  await h.button('Save location').props.onClick();h.render();
  assert.deepEqual(h.requests.find(r=>r.method==='POST').body,{location_id:'tml_2'});
  await h.button('Prepare this iPhone').props.onClick();
  assert.equal(h.preparations[0].locationId,'tml_2');
});
test('new location requires a complete address and sends only merchant-entered fields',async t=>{
  const h=await harness(t,{data:{selected_location_id:null,locations:[]}});
  assert.ok(h.button('Save location').props.disabled);
  for(const [label,value] of Object.entries({'Business name':'Acme','Street address':'123 Main St','City':'Charleston','State':'SC','ZIP code':'bad'})) {
    h.input(label).props.onChange({target:{value}});h.render();
  }
  assert.equal(h.button('Save location').props.disabled,true);
  h.input('ZIP code').props.onChange({target:{value:'29401'}});h.render();
  await h.button('Save location').props.onClick();h.render();
  assert.deepEqual(h.requests.find(r=>r.method==='POST').body,{display_name:'Acme',address:{line1:'123 Main St',city:'Charleston',state:'SC',postal_code:'29401',country:'US'}});
  assert.equal(h.preparations.length,0);
});
test('preparation shows progress, rejects double clicks, and cancellation ignores late success',async t=>{
  let finish!:()=>void;
  const h=await harness(t,{prepare:()=>new Promise<void>(resolve=>{finish=resolve;})});
  const click=h.button('Prepare this iPhone').props.onClick;
  const work=click();void click();await settle();h.progress('Configuring iPhone…');h.render();
  assert.equal(h.preparations.length,1);assert.match(text(h.tree),/Configuring iPhone/);
  assert.equal(h.button('How to tap').props.disabled,true);
  await h.button('Cancel setup').props.onClick();finish();await work;h.render();
  assert.equal(h.cancellations.length,1);assert.doesNotMatch(text(h.tree),/iPhone is ready/);
  assert.match(text(h.tree),/canceled/i);
});
for (const action of ['account','logout','unmount']) {
  test(`${action} during preparation cannot report readiness`,async t=>{
    let finish!:()=>void;
    const h=await harness(t,{prepare:()=>new Promise<void>(resolve=>{finish=resolve;})});
    assert.ok(h.button('Prepare this iPhone'));
    const work=h.button('Prepare this iPhone').props.onClick();await settle();
    if(action==='account')h.changeAccount();
    if(action==='logout')h.native.generation++;
    if(action==='unmount')h.renderer.dispose();
    finish();await work;h.render();
    assert.doesNotMatch(text(h.tree),/iPhone is ready/);
    if(action==='account')assert.match(text(h.tree),/account changed/i);
    if(action==='unmount')assert.equal(h.cancellations.length,1);
  });
}
