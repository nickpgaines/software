import type Stripe from 'stripe';
import { BillingError, requiredConfig } from './config';
import { BILLING_PLANS } from './catalog-public';
export { BILLING_PLANS } from './catalog-public';
export type { BillingInterval, BillingPlan } from './catalog-public';
import type { BillingInterval, BillingPlan } from './catalog-public';
export function selection(plan: unknown, interval: unknown): { plan: BillingPlan; interval: BillingInterval } {
  if (typeof plan !== 'string' || !Object.hasOwn(BILLING_PLANS, plan) || (interval !== 'month' && interval !== 'year')) throw new BillingError('Choose a valid plan and interval', 400);
  return { plan: plan as BillingPlan, interval };
}
export function configuredPrices() {
  return (Object.keys(BILLING_PLANS) as BillingPlan[]).flatMap(plan => (['month', 'year'] as const).map(interval => ({ plan, interval, id: requiredConfig(`FORGE_BILLING_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`) })));
}
export async function validatePrices(stripe: Stripe, live: boolean) {
  const configured = configuredPrices();
  if (new Set(configured.map(p => p.id)).size !== 6) throw new Error('Forge Price IDs must be distinct');
  for (const item of configured) {
    const p = await stripe.prices.retrieve(item.id);
    if (!p.active || p.livemode !== live || p.currency !== 'usd' || p.unit_amount !== BILLING_PLANS[item.plan][item.interval] || p.type !== 'recurring' || p.recurring?.interval !== item.interval || p.recurring.interval_count !== 1 || p.recurring.usage_type !== 'licensed' || p.billing_scheme !== undefined && p.billing_scheme !== 'per_unit') throw new Error('Forge Price does not match the approved catalog');
  }
  return configured;
}
