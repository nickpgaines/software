import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {nativeTerminal} from '../src/lib/native-terminal.ts';
// @ts-ignore Production effects; only browser and Capacitor boundaries are replaced.
import {loadCustomerModule,hookRenderer} from './helpers/customer-ui.mjs';

const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
let fixtureId=0;
async function harness(t:any,native=true) {
  const id=++fixtureId;
  const keys=['window','document','MutationObserver','__terminalApp','__terminalNative'];
  const originals=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  const listeners=new Map<string,Set<(value?:any)=>void>>();
  const app={addListener:async(event:string,callback:(value?:any)=>void)=>{
    const set=listeners.get(event)??new Set();set.add(callback);listeners.set(event,set);
    return {remove:async()=>{set.delete(callback);}};
  }};
  const document=Object.assign(new EventTarget(),{visibilityState:'visible',body:{},querySelector:()=>null});
  Object.assign(globalThis,{window:new EventTarget(),document,__terminalApp:app,__terminalNative:native,
    MutationObserver:class{observe(){}disconnect(){}}});
  const hooks=registerHooks({resolve(specifier,context,next){
    if(specifier==='@capacitor/app')return{url:`data:text/javascript,export const App=globalThis.__terminalApp;//${id}`,shortCircuit:true};
    if(specifier==='@capacitor/core')return{url:'data:text/javascript,export const Capacitor={isNativePlatform:()=>globalThis.__terminalNative}',shortCircuit:true};
    return next(specifier,context);
  }});
  let suspends=0,checks=0;
  t.mock.method(nativeTerminal,'suspend',async()=>{suspends++;});
  t.mock.method(nativeTerminal,'capabilities',async()=>{checks++;return{supported:false};});
  t.mock.method(nativeTerminal,'observeReadiness',async()=>({remove:async()=>{}}));
  const {TerminalLifecycleProvider}=await loadCustomerModule('components/payments/TerminalLifecycle.tsx');
  const renderer=hookRenderer();let disposed=false;
  const dispose=()=>{if(!disposed){disposed=true;renderer.dispose();}};
  t.after(()=>{dispose();hooks.deregister();for(const [key,value] of originals)value?Object.defineProperty(globalThis,key,value):Reflect.deleteProperty(globalThis,key);});
  renderer.render(TerminalLifecycleProvider,{identityKey:'test-admin',children:null});renderer.flushEffects();await settle();
  return {document,dispose,emit:async(event:string,value?:any)=>{for(const callback of listeners.get(event)??[])callback(value);await settle();},
    get suspends(){return suspends;},get checks(){return checks;},listeners};
}

test('native payment presentation becoming inactive and hiding the WebView does not cancel the reader',async t=>{
  const h=await harness(t);
  await h.emit('appStateChange',{isActive:false});
  h.document.visibilityState='hidden';h.document.dispatchEvent(new Event('visibilitychange'));await settle();
  assert.equal(h.suspends,0,'temporary native presentation must not cancel collection');
});
test('native background pause cancels even if the payment sheet already hid the WebView',async t=>{
  const h=await harness(t);h.document.visibilityState='hidden';
  await h.emit('pause');assert.equal(h.suspends,1);
  h.document.visibilityState='visible';const before=h.checks;
  await h.emit('appStateChange',{isActive:true});assert.ok(h.checks>before);
});
test('ordinary browser tab hiding still revokes the reader',async t=>{
  const h=await harness(t,false);h.document.visibilityState='hidden';
  h.document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(h.suspends,1);
});
test('unmount revokes the reader and late native events cannot touch the old controller',async t=>{
  const h=await harness(t);h.dispose();await settle();const checks=h.checks;
  assert.equal(h.suspends,1);await h.emit('pause');await h.emit('appStateChange',{isActive:true});
  assert.equal(h.suspends,1);assert.equal(h.checks,checks);
  assert.ok([...h.listeners.values()].every(set=>set.size===0));
});
