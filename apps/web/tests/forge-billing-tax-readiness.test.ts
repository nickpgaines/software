import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type Stripe from 'stripe';
import { fixture, provider } from './helpers/forge-billing-harness.mjs';

const hooks = registerHooks({resolve(specifier, context, next) {
  if (specifier.startsWith('./') && !specifier.endsWith('.ts') && context.parentURL?.includes('/src/lib/forge-billing/')) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const { checkTaxReadiness } = await import('../src/lib/forge-billing/tax-readiness.ts');
hooks.deregister();
const approved = {headOfficeState:'SC',taxCode:'txcd_10103000',taxBehavior:'exclusive' as const,states:['SC']};
const now = new Date('2026-09-26T12:00:00Z');
function setup() {
  fixture();
  const settings = {livemode:false,status:'active',defaults:{provider:'stripe'},head_office:{address:{country:'US',state:'SC'}}};
  const registrations = [{country:'US',country_options:{us:{state:'SC',type:'state_sales_tax'}},livemode:false,status:'active',active_from:1,expires_at:null as number|null}];
  const product = {id:'prod_forge',active:true,livemode:false,tax_code:approved.taxCode};
  const price = provider.api.prices.retrieve;
  provider.api.prices.retrieve = async (id:string) => ({...await price(id),product:'prod_forge',tax_behavior:'exclusive'});
  provider.api.products = {retrieve:async () => product};
  provider.api.tax = {
    settings:{retrieve:async () => settings},
    registrations:{list:() => ({async *[Symbol.asyncIterator]() {yield* registrations;}})},
  };
  return {settings,registrations,product,stripe:provider.api as Stripe};
}
test('tax preflight validates six configured prices without enabling billing or tax',async()=>{
  const {stripe}=setup(); process.env.FORGE_BILLING_ENABLED='false';
  const result=await checkTaxReadiness(stripe,false,approved,now);
  assert.deepEqual(result,{taxConfigurationReady:true,pricesChecked:6,states:['SC'],taxBehavior:'exclusive',launchAuthorized:false});
  assert.equal(process.env.FORGE_BILLING_ENABLED,'false');
  assert.equal(process.env.FORGE_BILLING_TAX_ENABLED,undefined);
  assert.equal(provider.customers.length,0); assert.equal(provider.sessions.length,0);
});
test('tax preflight requires explicit approved classification, behavior, and jurisdictions',async()=>{
  const {stripe}=setup();
  for(const options of [{...approved,states:[]},{...approved,states:['ZZ']},{...approved,headOfficeState:''},{...approved,taxCode:''},{...approved,taxBehavior:'automatic'}]) {
    await assert.rejects(()=>checkTaxReadiness(stripe,false,options as typeof approved,now),/approved tax configuration/i);
  }
});
test('tax preflight accepts explicitly approved inclusive prices without changing catalog amounts',async()=>{
  const {stripe}=setup(); const retrieve=provider.api.prices.retrieve;
  provider.api.prices.retrieve=async(id:string)=>({...await retrieve(id),tax_behavior:'inclusive'});
  const result=await checkTaxReadiness(stripe,false,{...approved,taxBehavior:'inclusive'},now);
  assert.equal(result.taxConfigurationReady,true); assert.equal(result.pricesChecked,6);
  assert.equal(result.taxBehavior,'inclusive'); assert.equal(result.launchAuthorized,false);
});
test('tax preflight rejects inactive settings and an unexpected head office or mode',async()=>{
  for (const mutation of [(s:any)=>s.status='pending',(s:any)=>s.head_office.address.state='NC',(s:any)=>s.livemode=true,(s:any)=>s.defaults.provider='avalara']) {
    const {stripe,settings}=setup(); mutation(settings);
    await assert.rejects(()=>checkTaxReadiness(stripe,false,approved,now),/tax settings/i);
  }
});
test('tax preflight rejects missing, future, expired, and wrong-mode registrations',async()=>{
  for(const mutation of [(r:any[])=>r.length=0,(r:any[])=>r[0].active_from=2000000000,(r:any[])=>r[0].expires_at=1,(r:any[])=>r[0].status='scheduled',(r:any[])=>r[0].livemode=true]) {
    const {stripe,registrations}=setup(); mutation(registrations);
    await assert.rejects(()=>checkTaxReadiness(stripe,false,approved,now),/registration/i);
  }
});
test('tax preflight rejects active registrations outside the approved scope',async()=>{
  const {stripe,registrations}=setup();
  registrations.push({...registrations[0],country_options:{us:{state:'NC',type:'state_sales_tax'}}});
  await assert.rejects(()=>checkTaxReadiness(stripe,false,approved,now),/registration/i);
});
test('tax preflight checks every price and requires explicit tax behavior and product tax code',async()=>{
  for (const mutation of ['last_price','behavior','code','product_mode','product_inactive']) {
    const {stripe,product}=setup(); const retrieve=provider.api.prices.retrieve;
    if(mutation==='code')product.tax_code='txcd_00000000';
    if(mutation==='product_mode')product.livemode=true;
    if(mutation==='product_inactive')product.active=false;
    provider.api.prices.retrieve=async(id:string)=>{
      const result=await retrieve(id);
      if(mutation==='behavior')result.tax_behavior='unspecified';
      if(mutation==='last_price' && id==='price_business_year')result.tax_behavior='inclusive';
      return result;
    };
    await assert.rejects(()=>checkTaxReadiness(stripe,false,approved,now),/price|product/i);
  }
});
test('tax preflight propagates unavailable tax APIs instead of reporting readiness',async()=>{
  const {stripe}=setup();
  provider.api.tax.settings.retrieve=async()=>{throw new Error('tax API unavailable');};
  await assert.rejects(()=>checkTaxReadiness(stripe,false,approved,now),/unavailable/);
});
test('read-only CLI rejects missing approval inputs and never prints credential-bearing errors',()=>{
  const script = new URL('../scripts/forge-billing-tax-check.mjs',import.meta.url);
  const run = (args:string[]) => spawnSync(process.execPath,['--no-warnings','--experimental-strip-types',fileURLToPath(script),...args],{
    encoding:'utf8',env:{...process.env,FORGE_BILLING_STRIPE_MODE:'test',FORGE_BILLING_STRIPE_SECRET_KEY:'must-not-print-this-secret'},
  });
  const missing = run([]);
  assert.equal(missing.status,1); assert.equal(JSON.parse(missing.stderr).taxConfigurationReady,false);
  assert.match(JSON.parse(missing.stderr).error,/Required:/);
  const invalid = run(['--head-office-state','SC','--tax-code','txcd_10103000','--tax-behavior','exclusive','--states','SC']);
  assert.equal(invalid.status,1); assert.equal(JSON.parse(invalid.stderr).launchAuthorized,false);
  assert.doesNotMatch(invalid.stdout+invalid.stderr,/must-not-print-this-secret/);
});
