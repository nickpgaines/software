import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeTerminal, nativeTerminalPlugin } from '../src/lib/native-terminal.ts';
import * as terminalModule from '../src/lib/native-terminal.ts';

test('Terminal requests carry native test mode without losing content headers',async()=>{
  const native={generation:0,capabilities:async()=>({supported:true,providerMode:'test' as const})};
  const options=await terminalModule.terminalRequestInit(native,'/api/stripe/terminal/attempts',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(new Headers(options.headers).get('X-Forge-Terminal-Mode'),'test');
  assert.equal(new Headers(options.headers).get('Content-Type'),'application/json');
  assert.equal(options.body,'{}');assert.equal(options.method,'POST');
  for(const url of ['/api/settings/company','https://untrusted.invalid/api/stripe/terminal/attempts','//untrusted.invalid/api/stripe/terminal/attempts']) {
    assert.equal(new Headers((await terminalModule.terminalRequestInit(native,url)).headers).has('X-Forge-Terminal-Mode'),false);
  }
});
test('Terminal mode lookup cannot send a mutation after logout',async()=>{
  let finish!:(value:any)=>void;let sent=false;
  const native={generation:0,capabilities:()=>new Promise<any>(resolve=>{finish=resolve;})};
  const work=terminalModule.terminalRequestInit(native,'/api/stripe/terminal/attempts',{method:'POST'}).then(()=>{sent=true;});
  native.generation++;finish({supported:true,providerMode:'test'});
  await assert.rejects(work,/session/i);assert.equal(sent,false);
});

test('unavailable native builds explain manual fallback', async () => {
  const terminal = new NativeTerminal(async () => null);
  assert.equal((await terminal.capabilities()).supported, false);
  assert.match((await terminal.capabilities()).reason!, /manual|card/i);
});

test('device preparation shares the exclusive reader lock and ignores progress after reset', async () => {
  let finish!:()=>void;
  let listener!:(event:any)=>void;
  let removed=0;
  const progress:string[]=[];
  const terminal = new NativeTerminal(async()=>({
    getCapabilities:async()=>({supported:true,preparationSupported:true}),
    prepareDevice:async()=>new Promise<void>(resolve=>{finish=resolve;}),
    addListener:async(_name,callback)=>{listener=callback;return{remove:async()=>{removed++;}};},
    collectPayment:async()=>({intentId:'pi'}),collectSetup:async()=>({intentId:'seti'}),
    reset:async()=>{},cancel:async()=>{},showEducation:async()=>{},
  }));
  const args={operationId:'prepare',stripeAccount:'acct_1',locationId:'tml_1',representativeConfirmed:true};
  const pending=terminal.prepare(args,Symbol('setup'),event=>progress.push(event.message));
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(terminal.collect('payment',{...args,saveCard:false,clientSecret:'secret'}),/already/);
  listener({operationId:'other',phase:'preparing',message:'wrong'});
  listener({operationId:'prepare',phase:'preparing',message:'current'});
  await terminal.reset();
  listener({operationId:'prepare',phase:'preparing',message:'late'});
  finish(); await assert.rejects(pending,/session/);
  assert.deepEqual(progress,['current']);assert.equal(removed,1);
});

test('old native builds cannot prepare or collect with unsafe default merchant terms',async()=>{
  const terminal=new NativeTerminal(async()=>({
    getCapabilities:async()=>({supported:true}),
    collectPayment:async()=>({intentId:'pi'}),collectSetup:async()=>({intentId:'seti'}),
    reset:async()=>{},cancel:async()=>{},showEducation:async()=>{},
  }));
  await assert.rejects(terminal.prepare({operationId:'prepare',stripeAccount:'acct_1',locationId:'tml_1',representativeConfirmed:false}),/update/i);
  for(const operation of ['payment','setup'] as const)await assert.rejects(terminal.collect(operation,{operationId:'pay',stripeAccount:'acct_1',locationId:'tml_1',clientSecret:'secret',saveCard:false}),/update/i);
});

test('one collection runs and reset invalidates late native success synchronously', async () => {
  let finish!: (value: {intentId: string}) => void;
  let collections = 0;
  const terminal = new NativeTerminal(async () => ({
    getCapabilities: async () => ({ supported: true, preparationSupported:true }), showEducation: async () => {},
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
  const terminal=new NativeTerminal(async()=>({getCapabilities:async()=>({supported:true,preparationSupported:true}),collectPayment:async()=>new Promise(resolve=>{finish=resolve;}),cancel:async()=>{cancelCalls++;},reset:async()=>{},showEducation:async()=>{},collectSetup:async()=>({intentId:'seti'})}));
  const operation=terminal.collect('payment',{operationId:'new',clientSecret:'secret',stripeAccount:'acct',locationId:'tml',saveCard:false});
  await new Promise(resolve=>setImmediate(resolve));
  await terminal.cancel('old');
  assert.equal(cancelCalls,0);
  finish({intentId:'pi'});await operation;
});

test('an old flow cannot cancel a new flow resuming the same attempt ID',async()=>{
  let cancelCalls=0;let finish!:(value:{intentId:string})=>void;
  const terminal=new NativeTerminal(async()=>({getCapabilities:async()=>({supported:true,preparationSupported:true}),collectPayment:async()=>new Promise(resolve=>{finish=resolve;}),cancel:async()=>{cancelCalls++;},reset:async()=>{},showEducation:async()=>{},collectSetup:async()=>({intentId:'seti'})}));
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
    getCapabilities:async()=>({supported:true,preparationSupported:true}),showEducation:async()=>{},
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
