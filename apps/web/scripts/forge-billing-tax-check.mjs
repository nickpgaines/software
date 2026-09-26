// Read-only. Supply dedicated Forge billing environment variables securely.
// Node 24+ is required for registerHooks and TypeScript type stripping.
import { registerHooks } from 'node:module';
import { parseArgs } from 'node:util';

const hooks = registerHooks({resolve(specifier,context,next) {
  if (specifier.startsWith('./') && !specifier.endsWith('.ts') && context.parentURL?.includes('/src/lib/forge-billing/')) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {verifyProvider} = await import('../src/lib/forge-billing/provider.ts');
const {checkTaxReadiness,TaxReadinessError} = await import('../src/lib/forge-billing/tax-readiness.ts');
hooks.deregister();

try {
  const {values} = parseArgs({options:{
    'head-office-state':{type:'string'}, 'tax-code':{type:'string'},
    'tax-behavior':{type:'string'}, states:{type:'string'},
  }});
  if (!values['head-office-state'] || !values['tax-code'] || !values['tax-behavior'] || !values.states) {
    throw new TaxReadinessError('Required: --head-office-state STATE --tax-code APPROVED_CODE --tax-behavior inclusive|exclusive --states COMMA_SEPARATED_APPROVED_STATES');
  }
  const {stripe,live} = await verifyProvider();
  const result = await checkTaxReadiness(stripe,live,{
    headOfficeState:values['head-office-state'],taxCode:values['tax-code'],
    taxBehavior:values['tax-behavior'],states:values.states.split(',').map(s=>s.trim()),
  });
  console.log(JSON.stringify({...result,mode:live?'live':'test',billingEnabled:process.env.FORGE_BILLING_ENABLED==='true',taxEnabled:process.env.FORGE_BILLING_TAX_ENABLED==='true'}));
} catch (error) {
  // Stripe errors can include request data. Never print raw errors or credentials.
  console.error(JSON.stringify({taxConfigurationReady:false,launchAuthorized:false,error:error instanceof TaxReadinessError ? error.message : 'Unable to verify tax configuration. Check dedicated credentials, read permissions, account identity, catalog, and API availability.'}));
  process.exitCode=1;
}
