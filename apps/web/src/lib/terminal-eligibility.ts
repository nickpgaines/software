import {getStripe,getCompany,isStripeConfigured} from '@/lib/stripe';
import {requireTerminalEnvironment} from '@/lib/terminal-environment';
import {TerminalError} from '@/lib/terminal-http';

/** Fresh provider read; a redirect parameter or cached enabled flag is not approval. */
export async function getTerminalEligibility(companyId:number):Promise<{eligible:boolean;stripe_account:string|null}> {
  requireTerminalEnvironment();
  if(!isStripeConfigured())throw new TerminalError('Payment setup is temporarily unavailable.',503);
  const company=await getCompany(companyId);
  if(!company.stripe_account_id)return {eligible:false,stripe_account:null};
  const account=await getStripe().accounts.retrieve(company.stripe_account_id);
  if(account.id!==company.stripe_account_id || (await getCompany(companyId)).stripe_account_id!==account.id)throw new TerminalError('The connected account changed. Reopen Payments settings.',409);
  return {eligible:account.charges_enabled===true&&account.details_submitted===true&&account.country==='US',stripe_account:account.id};
}
