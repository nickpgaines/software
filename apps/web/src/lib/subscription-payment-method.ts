import { getDb, type StripePaymentMethod, type CustomerSubscription } from '@/lib/db';
import { getCompany, getStripe } from '@/lib/stripe';
import { TerminalError, positiveId } from '@/lib/terminal-http';

export async function validateSubscriptionPaymentMethod(companyId: number, customerId: number, rowId: unknown) {
  const db = await getDb();
  const pm = await db.prepare('SELECT * FROM stripe_payment_methods WHERE id=? AND company_id=? AND customer_id=?').get<StripePaymentMethod>(positiveId(rowId),companyId,customerId);
  if (!pm) throw new TerminalError('Saved card not found for this customer',404);
  const company = await getCompany(companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled || (pm.stripe_account_id && pm.stripe_account_id !== company.stripe_account_id)) throw new TerminalError('Saved card account is unavailable',409);
  const canonical = await getStripe().paymentMethods.retrieve(pm.stripe_payment_method_id,undefined,{ stripeAccount: company.stripe_account_id });
  const mapping = await db.prepare('SELECT stripe_customer_id FROM stripe_customers WHERE company_id=? AND customer_id=?').get<{ stripe_customer_id: string }>(companyId,customerId);
  const customer = typeof canonical.customer === 'string' ? canonical.customer : canonical.customer?.id;
  const now = new Date();
  if (!mapping || customer !== mapping.stripe_customer_id || canonical.type !== 'card' || !canonical.card || canonical.card.exp_year < now.getUTCFullYear() || (canonical.card.exp_year === now.getUTCFullYear() && canonical.card.exp_month < now.getUTCMonth()+1)) throw new TerminalError('Saved card is detached, expired, or unavailable',409);
  return { pm, stripeAccount: company.stripe_account_id };
}
export async function selectSubscriptionPaymentMethod(companyId: number, subId: number, rowId: unknown) {
  const db = await getDb();
  const sub = await db.prepare('SELECT * FROM customer_subscriptions WHERE id=? AND company_id=?').get<CustomerSubscription>(positiveId(subId),companyId);
  if (!sub) throw new TerminalError('Subscription not found',404);
  if (!sub.accepted_at || (sub.require_signature && !sub.signature_data) || ['canceled','declined'].includes(sub.status)) throw new TerminalError('Subscription must be accepted and signed before selecting a card',409);
  const { pm, stripeAccount } = await validateSubscriptionPaymentMethod(companyId,sub.customer_id,rowId);
  if (sub.stripe_subscription_id) {
    const remote = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id,undefined,{ stripeAccount });
    const customer = typeof remote.customer === 'string' ? remote.customer : remote.customer.id;
    if (customer !== pm.stripe_customer_id) throw new TerminalError('Subscription belongs to a different customer',409);
    await getStripe().subscriptions.update(sub.stripe_subscription_id,{ default_payment_method: pm.stripe_payment_method_id, proration_behavior: 'none' },{ stripeAccount });
  }
  await db.prepare('UPDATE customer_subscriptions SET default_payment_method_id=? WHERE id=? AND company_id=?').run(pm.stripe_payment_method_id,sub.id,companyId);
  return db.prepare('SELECT * FROM customer_subscriptions WHERE id=? AND company_id=?').get(sub.id,companyId);
}
