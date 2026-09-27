import { getDb } from '@/lib/db';
import { BILLING_PLANS, configuredPrices } from './catalog';
import { BillingError } from './config';
import { type BillingAccount, objectId, verifyProvider } from './provider';

export async function readBillingAccount(companyId: number): Promise<BillingAccount | undefined> {
  return (await getDb()).prepare('SELECT * FROM forge_billing_accounts WHERE company_id=?').get<BillingAccount>(companyId);
}

/** Each fetch claims a generation BEFORE remote reads. A slow older fetch cannot overwrite a newer one. */
export async function reconcileCompany(companyId: number): Promise<void> {
  const db = await getDb();
  const account = await db.transaction(async tx => {
    await tx.prepare('UPDATE forge_billing_accounts SET sync_version=sync_version+1 WHERE company_id=?').run(companyId);
    return tx.prepare('SELECT * FROM forge_billing_accounts WHERE company_id=?').get<BillingAccount>(companyId);
  });
  if (!account?.customer_id) return;
  const { stripe, live } = await verifyProvider(account);
  const subscriptions = [];
  for await (const sub of stripe.subscriptions.list({ customer: account.customer_id, status: 'all', limit: 100 })) {
    if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') subscriptions.push(sub);
  }
  if (subscriptions.length > 1) throw new BillingError('Multiple subscriptions require billing support', 503);
  const id = subscriptions[0]?.id ?? account.subscription_id;
  if (!id) return;
  const sub = await stripe.subscriptions.retrieve(id);
  if (sub.livemode !== live || objectId(sub.customer) !== account.customer_id) throw new Error('Subscription ownership mismatch');
  const item = sub.items.data[0];
  const priceId = item?.price.id;
  const plan = configuredPrices().find(p => p.id === priceId);
  const reservation = await db.prepare('SELECT price_id FROM forge_billing_checkout WHERE company_id=?').get<{price_id:string}>(companyId);
  const boundPrice = account.subscription_id === sub.id ? account.price_id : reservation?.price_id;
  if (!plan || sub.items.data.length !== 1 || item.quantity !== 1 || !boundPrice || boundPrice !== priceId) throw new Error('Subscription price binding mismatch');
  let paidThrough = 0;
  // Paid invoices, not an active status or browser redirect, establish entitlement.
  for await (const invoice of stripe.invoices.list({ customer: account.customer_id, subscription: sub.id, status: 'paid', limit: 100 })) {
    if (invoice.livemode !== live || objectId(invoice.customer) !== account.customer_id || invoice.status !== 'paid' || invoice.amount_paid <= 0 || invoice.amount_remaining !== 0 || objectId(invoice.parent?.subscription_details?.subscription) !== sub.id) continue;
    if (invoice.lines.has_more) throw new Error('Unexpected paginated Forge invoice');
    for (const line of invoice.lines.data) {
      if (objectId(line.parent?.subscription_item_details?.subscription) === sub.id && objectId(line.pricing?.price_details?.price) === priceId && line.amount > 0) paidThrough = Math.max(paidThrough, line.period.end);
    }
  }
  const entitled = ['active', 'past_due'].includes(sub.status);
  const paid = entitled && paidThrough ? new Date(paidThrough * 1000).toISOString() : null;
  const applied = await db.prepare(`UPDATE forge_billing_accounts SET subscription_id=?,subscription_status=?,price_id=?,plan=?,interval=?,seat_limit=?,paid_through=?,cancel_at_period_end=? WHERE company_id=? AND sync_version=?`)
    .run(sub.id, sub.status, priceId, plan.plan, plan.interval, BILLING_PLANS[plan.plan].seats, paid, sub.cancel_at_period_end ? 1 : 0, companyId, account.sync_version);
  // Never acknowledge a webhook whose snapshot lost the race; the newer fetch may itself fail.
  if (!applied.changes) throw new BillingError('Billing reconciliation was superseded; retry',503);
}
