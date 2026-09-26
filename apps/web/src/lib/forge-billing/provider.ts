import Stripe from 'stripe';
import { requiredConfig } from './config';
export type BillingAccount = {
  company_id: number; account_id: string; livemode: number; customer_id: string | null; customer_key: string;
  deleting: number; sync_version: number; subscription_id: string | null; subscription_status: string | null;
  price_id: string | null; plan: 'solo' | 'team' | 'business' | null; interval: 'month' | 'year' | null;
  seat_limit: number | null; paid_through: string | null; cancel_at_period_end: number;
};
export function billingProvider() {
  const key = requiredConfig('FORGE_BILLING_STRIPE_SECRET_KEY');
  const mode = requiredConfig('FORGE_BILLING_STRIPE_MODE');
  const keyMode = /^(?:sk|rk)_(test|live)_.+$/.exec(key)?.[1];
  if (!['test','live'].includes(mode) || keyMode !== mode) throw new Error('Forge key mode mismatch');
  return { stripe: new Stripe(key, { maxNetworkRetries: 0 }), live: mode === 'live', accountId: requiredConfig('FORGE_BILLING_STRIPE_ACCOUNT_ID') };
}
export async function verifyProvider(account?: BillingAccount) {
  const provider = billingProvider();
  if (account && (account.account_id !== provider.accountId || Boolean(account.livemode) !== provider.live)) throw new Error('Forge billing account configuration changed');
  // Null retrieves the key's own account, rather than a connected account it can access.
  const actual = await provider.stripe.accounts.retrieve(null);
  if (actual.id !== provider.accountId) throw new Error('Forge platform account mismatch');
  if (account?.customer_id) {
    const customer = await provider.stripe.customers.retrieve(account.customer_id);
    if (customer.deleted || customer.livemode !== provider.live || customer.metadata.forge_company_id !== String(account.company_id)) throw new Error('Forge customer ownership mismatch');
  }
  return provider;
}
export const objectId = (value: string | { id: string } | null | undefined): string | null => typeof value === 'string' ? value : value?.id ?? null;
