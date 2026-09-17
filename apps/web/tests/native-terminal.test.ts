import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeTerminal, nativeTerminalPlugin } from '../src/lib/native-terminal.ts';

test('unavailable native builds explain manual fallback', async () => {
  const terminal = new NativeTerminal(async () => null);
  assert.equal((await terminal.capabilities()).supported, false);
  assert.match((await terminal.capabilities()).reason!, /manual|card/i);
});

test('one collection runs and reset invalidates late native success synchronously', async () => {
  let finish!: (value: {intentId: string}) => void;
  let collections = 0;
  const terminal = new NativeTerminal(async () => ({
    getCapabilities: async () => ({ supported: true }), showEducation: async () => {},
    collectPayment: async () => { collections++; return new Promise(resolve => { finish = resolve; }); },
    collectSetup: async () => ({intentId: 'seti_1'}), cancel: async () => {}, reset: async () => {},
  }));
  const args = {operationId: 'attempt_1', clientSecret: 'secret', stripeAccount: 'acct_1', locationId: 'tml_1', saveCard: false};
  const first = terminal.collect('payment', args);
  await assert.rejects(terminal.collect('payment', args), /already/i);
  await new Promise(resolve => setImmediate(resolve));
  const generation = terminal.generation;
  const reset = terminal.reset();
  assert.notEqual(terminal.generation, generation);
  finish({intentId: 'pi_1'});
  await assert.rejects(first, /session/i);
  await reset;
  assert.equal(collections, 1);
});

test('real Capacitor proxy is returned as a plain non-thenable facade', {timeout: 2000}, async t => {
  const keys = ['window', 'webkit', 'Capacitor'];
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => keys.forEach((key, index) => originals[index] ? Object.defineProperty(globalThis,key,originals[index]!) : Reflect.deleteProperty(globalThis,key)));
  Object.assign(globalThis, {window: globalThis, webkit: {messageHandlers:{bridge:{}}}, Capacitor:{
    PluginHeaders:[{name:'ForgeTerminal',methods:[{name:'getCapabilities',rtype:'promise'}]}],
    nativePromise: async (plugin: string, method: string) => { assert.equal(plugin,'ForgeTerminal'); assert.equal(method,'getCapabilities'); return {supported:true}; },
  }});
  const plugin = await nativeTerminalPlugin();
  assert.equal((await plugin!.getCapabilities()).supported,true);
});

test('stalled cleanup is bounded and prevents reuse', async () => {
  const terminal = new NativeTerminal(async () => ({reset: () => new Promise(() => {})} as any), 5);
  await terminal.reset();
  assert.equal((await terminal.capabilities()).supported,false);
});

test('cleanup from an old owner never cancels the replacement collection', async () => {
  let cancelCalls=0;
  let finish!: (value:{intentId:string})=>void;
  const terminal=new NativeTerminal(async()=>({getCapabilities:async()=>({supported:true}),collectPayment:async()=>new Promise(resolve=>{finish=resolve;}),cancel:async()=>{cancelCalls++;},reset:async()=>{},showEducation:async()=>{},collectSetup:async()=>({intentId:'seti'})}));
  const operation=terminal.collect('payment',{operationId:'new',clientSecret:'secret',stripeAccount:'acct',locationId:'tml',saveCard:false});
  await new Promise(resolve=>setImmediate(resolve));
  await terminal.cancel('old');
  assert.equal(cancelCalls,0);
  finish({intentId:'pi'});await operation;
});

test('an old flow cannot cancel a new flow resuming the same attempt ID',async()=>{
  let cancelCalls=0;let finish!:(value:{intentId:string})=>void;
  const terminal=new NativeTerminal(async()=>({getCapabilities:async()=>({supported:true}),collectPayment:async()=>new Promise(resolve=>{finish=resolve;}),cancel:async()=>{cancelCalls++;},reset:async()=>{},showEducation:async()=>{},collectSetup:async()=>({intentId:'seti'})}));
  const oldLease=Symbol('old');const newLease=Symbol('new');
  const operation=terminal.collect('payment',{operationId:'same',clientSecret:'secret',stripeAccount:'acct',locationId:'tml',saveCard:false},newLease);
  await new Promise(resolve=>setImmediate(resolve));
  await terminal.cancel('same',oldLease);
  assert.equal(cancelCalls,0);
  finish({intentId:'pi'});await operation;
});

test('reset cannot release collection ownership while an earlier cancellation is pending',async()=>{
  let finishCancel!:()=>void;
  const completions=new Map<string,(value:{intentId:string})=>void>();
  const terminal=new NativeTerminal(async()=>({
    getCapabilities:async()=>({supported:true}),showEducation:async()=>{},
    collectPayment:args=>new Promise(resolve=>{completions.set(args.operationId,resolve);}),
    collectSetup:async()=>({intentId:'seti'}),
    cancel:()=>new Promise(resolve=>{finishCancel=resolve;}),reset:async()=>{},
  }));
  const args=(id:string)=>({operationId:id,clientSecret:'secret',stripeAccount:'acct',locationId:'tml',saveCard:false});
  const first=terminal.collect('payment',args('A'));
  const firstOutcome=assert.rejects(first,/session/);
  await new Promise(resolve=>setImmediate(resolve));
  const cancel=terminal.cancel('A');
  await new Promise(resolve=>setImmediate(resolve));
  await terminal.reset();
  const blocked=terminal.collect('payment',args('blocked'));
  // Attach the expectation immediately; the old implementation admits this
  // collection, so settle its external boundary to expose the missing rejection.
  const rejection=assert.rejects(blocked,/already/);
  await new Promise(resolve=>setImmediate(resolve));
  completions.get('blocked')?.({intentId:'pi_blocked'});
  await rejection;
  finishCancel();await cancel;
  const second=terminal.collect('payment',args('B'));
  await new Promise(resolve=>setImmediate(resolve));
  completions.get('A')!({intentId:'pi_A'});await firstOutcome;
  await assert.rejects(terminal.collect('payment',args('C')),/already/);
  completions.get('B')!({intentId:'pi_B'});await second;
});
