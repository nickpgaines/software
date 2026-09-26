import type Stripe from 'stripe';
import { objectId, type BillingAccount } from './provider';

/** Operator diagnostics only: never mutate tax, collect money, or revoke paid access. */
export async function reportTaxIssue(stripe: Stripe, event: Stripe.Event, account: BillingAccount) {
  if (!account.subscription_id) return;
  let issue: 'automatic_tax_disabled' | 'requires_location_inputs' | 'failed' | undefined;
  let id: string;
  if (event.type === 'invoice.finalization_failed' || event.type === 'invoice.updated' || event.type === 'invoice.paid') {
    id = event.data.object.id;
    const invoice = await stripe.invoices.retrieve(id);
    if (invoice.livemode !== !!account.livemode || objectId(invoice.customer) !== account.customer_id) {
      throw new Error('Tax diagnostic invoice ownership mismatch');
    }
    // A customer can have other/manual invoices; do not attribute them to Forge.
    if (objectId(invoice.parent?.subscription_details?.subscription) !== account.subscription_id) return;
    const tax = invoice.automatic_tax;
    if (tax?.disabled_reason) issue = 'automatic_tax_disabled';
    else if (tax?.enabled && (tax.status === 'requires_location_inputs' || tax.status === 'failed')) issue = tax.status;
  } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    id = event.data.object.id;
    if (id !== account.subscription_id) return;
    const subscription = await stripe.subscriptions.retrieve(id);
    if (subscription.livemode !== !!account.livemode || objectId(subscription.customer) !== account.customer_id) {
      throw new Error('Tax diagnostic subscription ownership mismatch');
    }
    if (subscription.automatic_tax?.disabled_reason) issue = 'automatic_tax_disabled';
  } else return;
  // Canonical reads prevent late failure events from reporting a resolved issue.
  // No raw provider messages, addresses, emails, or payment details in logs.
  if (issue) console.warn('[forge-billing-tax]', {companyId:account.company_id,eventId:event.id,objectId:id,issue});
}
