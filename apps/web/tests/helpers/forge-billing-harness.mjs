import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
export let session;
export const getSessionContext = async () => session;
export const setSession = value => { session = value; };
let database;
export const getDb = async () => database;
/** @type {{calls:any[],customers:any[],sessions:any[],subscriptions:any[],invoices:any[],lost:boolean,hidden:boolean,fail:boolean,event:any,invalidSignature:boolean,invalidPrice:boolean,mode:boolean,beforeRetrieve:any,api:any}} */
export const provider = {};
export default class Stripe {
  constructor() { return provider.api; }
}
export function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE company(id INTEGER PRIMARY KEY); INSERT INTO company VALUES(1),(2);
    CREATE TABLE staff(id INTEGER PRIMARY KEY,company_id INTEGER,permission_level TEXT,custom_role_id INTEGER,created_at TEXT DEFAULT '2026-09-01 12:00:00');
    INSERT INTO staff(id,company_id,permission_level,custom_role_id) VALUES(7,1,'admin',NULL),(8,2,'technician',NULL);
    CREATE TABLE custom_roles(id INTEGER PRIMARY KEY,company_id INTEGER,permissions TEXT);`);
  let chain = Promise.resolve();
  const db = { sqlite, prepare: sql => { const s = sqlite.prepare(sql); return { get: async (...a) => s.get(...a), all: async (...a) => s.all(...a), run: async (...a) => s.run(...a) }; }, exec: async sql => sqlite.exec(sql), transaction: fn => { const run = chain.then(async () => { sqlite.exec('BEGIN IMMEDIATE'); try { const result = await fn(db); sqlite.exec('COMMIT'); return result; } catch(e) { sqlite.exec('ROLLBACK'); throw e; } }); chain = run.catch(() => {}); return run; } };
  database = db;
  session = { companyId:1, staffId:7, identity:'admin@test', isPlatformAdmin:false };
  Object.assign(process.env, { FORGE_BILLING_ENABLED:'true', FORGE_BILLING_STRIPE_SECRET_KEY:'sk_test_fake', FORGE_BILLING_STRIPE_ACCOUNT_ID:'acct_platform', FORGE_BILLING_STRIPE_MODE:'test', FORGE_BILLING_WEBHOOK_SECRET:'whsec_fake', FORGE_BILLING_SITE_ORIGIN:'https://forge.test', FORGE_BILLING_PORTAL_CONFIGURATION_ID:'bpc_test' });
  delete process.env.FORGE_BILLING_CUTOFF_AT;
  for (const p of ['SOLO','TEAM','BUSINESS']) for (const i of ['MONTH','YEAR']) process.env[`FORGE_BILLING_PRICE_${p}_${i}`] = `price_${p.toLowerCase()}_${i.toLowerCase()}`;
  Object.assign(provider, { calls:[], customers:[], sessions:[], subscriptions:[], invoices:[], lost:false, hidden:false, fail:false, event:null, invalidSignature:false, invalidPrice:false, mode:false, beforeRetrieve:null });
  const check = () => { if (provider.fail) throw new Error('provider unavailable'); };
  const list = data => ({ data, has_more:false, async *[Symbol.asyncIterator]() { for (const row of data) yield row; } });
  provider.api = {
    accounts:{ retrieve:async () => { check(); provider.calls.push('account'); return { id:'acct_platform' }; } },
    customers:{ create:async (body, opts) => { check(); provider.calls.push({ customer:body, opts }); const c={ id:`cus_${provider.customers.length+1}`,livemode:provider.mode,...body }; provider.customers.push(c); return c; }, retrieve:async id => provider.customers.find(c=>c.id===id) },
    prices:{ retrieve:async id => { check(); const [,p,i]=id.split('_'); return { id, active:true, livemode:provider.mode, currency:'usd', unit_amount:provider.invalidPrice ? 1 : {solo:{month:7900,year:79000},team:{month:14900,year:149000},business:{month:22900,year:229000}}[p][i], type:'recurring', recurring:{interval:i,interval_count:1,usage_type:'licensed'} }; } },
    checkout:{ sessions:{ create:async (body,opts) => { check(); provider.calls.push({ checkout:body,opts }); const s={ id:`cs_${provider.sessions.length+1}`,livemode:provider.mode,status:'open',url:'https://checkout.stripe.com/test',...body }; provider.sessions.push(s); if(provider.lost) throw new Error('lost response'); return s; }, retrieve:async id => { check(); return provider.sessions.find(s=>s.id===id); }, list:params => { check(); return list(provider.hidden ? [] : provider.sessions.filter(s=>s.customer===params.customer)); }, expire:async id => { const s=provider.sessions.find(s=>s.id===id); s.status='expired'; return s; } } },
    subscriptions:{ list:params => { check(); return list(provider.subscriptions.filter(s=>s.customer===params.customer)); }, retrieve:async id => { check(); const s=structuredClone(provider.subscriptions.find(s=>s.id===id)); await provider.beforeRetrieve?.(); return s; }, cancel:async id => { check(); const s=provider.subscriptions.find(s=>s.id===id); s.status='canceled'; return s; } },
    invoices:{ list:params => list(provider.invoices.filter(i=>i.parent.subscription_details.subscription===params.subscription)) },
    billingPortal:{ configurations:{ retrieve:async () => ({ active:true,livemode:false,features:{subscription_update:{enabled:false},subscription_cancel:{enabled:true},payment_method_update:{enabled:true}}}) }, sessions:{create:async body => { provider.calls.push({portal:body}); return {url:'https://billing.stripe.com/test'}; } } },
    webhooks:{constructEvent:() => { if(provider.invalidSignature) throw new Error('signature'); return provider.event; }},
  };
  return db;
}
export function paidSubscription(customer='cus_1', status='active') {
  const s={ id:`sub_${provider.subscriptions.length+1}`,customer,livemode:false,status,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_solo_month'},current_period_end:1793422800}] } };
  provider.subscriptions.push(s);
  provider.invoices.push({id:'in_1',status:'paid',paid:true,livemode:false,customer,amount_paid:7900,amount_remaining:0,parent:{subscription_details:{subscription:s.id}},lines:{has_more:false,data:[{amount:7900,period:{start:1790744400,end:1793422800},parent:{subscription_item_details:{subscription:s.id}},pricing:{price_details:{price:'price_solo_month'}}}]}});
  return s;
}
/** @returns {Promise<{service:typeof import('../../src/lib/forge-billing/service.ts'),access:typeof import('../../src/lib/forge-billing/access.ts'),schema:typeof import('../../src/lib/forge-billing/schema.ts'),routes:Record<string,any>}>} */
export async function loadBilling() {
  const hooks=registerHooks({resolve(specifier,context,next){
    if(specifier==='stripe' || specifier==='@/lib/db' || specifier==='@/lib/auth') return {url:import.meta.url,shortCircuit:true};
    if(specifier==='next/server') return next('next/server.js',context);
    if(specifier==='next/navigation') return next('next/navigation.js',context);
    if(specifier.startsWith('@/')) return next(new URL(`../../src/${specifier.slice(2)}.ts`,import.meta.url).href,context);
    if(specifier.startsWith('./') && !specifier.endsWith('.ts') && context.parentURL?.includes('/src/lib/forge-billing/')) return next(`${specifier}.ts`,context);
    return next(specifier,context);
  }});
  try { const service=await import('../../src/lib/forge-billing/service.ts'); const access=await import('../../src/lib/forge-billing/access.ts'); const schema=await import('../../src/lib/forge-billing/schema.ts'); /** @type {Record<string,any>} */ const routes={}; for(const name of ['status','checkout','portal','refresh','webhook','public']) routes[name]=await import(`../../src/app/api/forge-billing/${name}/route.ts`); return {service,access,schema,routes}; } finally { hooks.deregister(); }
}
