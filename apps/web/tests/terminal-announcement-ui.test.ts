import assert from 'node:assert/strict';
import test from 'node:test';
import {TerminalPresentationGate} from '../src/lib/terminal-presentation.ts';
// @ts-ignore production hooks and JSX handlers
import {loadCustomerModule,hookRenderer,elements,text} from './helpers/customer-ui.mjs';
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
test('nested presentation owners cannot unblock a still-open payment or modal',()=>{
  const gate=new TerminalPresentationGate();const checkout=gate.acquire();const recovery=gate.acquire();
  assert.equal(gate.blocked,true);checkout();checkout();assert.equal(gate.blocked,true);recovery();assert.equal(gate.blocked,false);
});
async function harness(t:any,options:any={}) {
  const originals=['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const document=Object.assign(new EventTarget(),{visibilityState:options.hidden?'hidden':'visible'});
  Object.assign(globalThis,{window:new EventTarget(),document});
  const ctx={presentationBlocked:options.blocked??false};const renderer=hookRenderer({contextValue:ctx});
  t.after(()=>{renderer.dispose();for(const [key,value] of originals)value?Object.defineProperty(globalThis,key as string,value):Reflect.deleteProperty(globalThis,key as string);});
  const calls:any[]=[];const native={generation:0,active:false,capabilities:async()=>({supported:options.supported??true,preparationSupported:true})};
  t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{calls.push({url,method:init?.method??'GET',body:init?.body});if(options.fetch)return options.fetch(url,init);return Response.json(init?.method==='POST'?{acknowledged:true}:{announcement:{version:'test-only',title:'Tap to Pay on iPhone',body:'Approved fixture content'}});});
  const {default:Panel}=await loadCustomerModule('components/payments/TerminalAnnouncement.tsx');
  let tree:any;const render=()=>{tree=renderer.render(Panel,{identityKey:'staff:7',native});renderer.flushEffects();return tree;};
  render();await settle();render();return {render,ctx,calls,native,document,get tree(){return tree;}};
}
test('blocked announcement waits without acknowledgment and becomes available after dismissal',async t=>{
  const h=await harness(t,{blocked:true});assert.equal(h.tree,null);assert.equal(h.calls.some((c:any)=>c.method==='POST'),false);
  h.ctx.presentationBlocked=false;h.render();await settle();h.render();assert.match(text(h.tree),/Tap to Pay/);
  await elements(h.tree,(el:any)=>el.type?.displayName==='Button'&&text(el)==='Not now')[0].props.onClick();h.render();
  assert.equal(h.tree,null);assert.deepEqual(JSON.parse(h.calls.find((c:any)=>c.method==='POST').body),{version:'test-only'});
});
for(const options of [{supported:false},{hidden:true}])test(`unsupported or hidden client never shows or acknowledges launch content ${JSON.stringify(options)}`,async t=>{
  const h=await harness(t,options);assert.equal(h.tree,null);assert.equal(h.calls.length,0);
});
test('late announcement after logout is discarded',async t=>{
  let finish!:(r:Response)=>void;const h=await harness(t,{fetch:()=>new Promise(resolve=>{finish=resolve;})});
  h.native.generation++;finish(Response.json({announcement:{version:'test-only',title:'Private merchant',body:'Content'}}));await settle();h.render();assert.equal(h.tree,null);
});
