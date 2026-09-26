import type Stripe from 'stripe';

export function isSafeBillingPortal(portal: Stripe.BillingPortal.Configuration, live: boolean): boolean {
  return portal.active && portal.livemode === live && !portal.features.subscription_update.enabled &&
    portal.features.subscription_cancel.enabled && portal.features.payment_method_update.enabled;
}

export function hasBillingAddressRecovery(portal: Stripe.BillingPortal.Configuration): boolean {
  return !!portal.features.customer_update?.enabled && portal.features.customer_update.allowed_updates.includes('address');
}
