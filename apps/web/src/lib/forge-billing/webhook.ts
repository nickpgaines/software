import { getDb } from '@/lib/db';
import { BillingError, requiredConfig } from './config';
import { billingProvider, objectId, type BillingAccount } from './provider';
import { reconcileCompany } from './reconcile';
const EVENTS = new Set(['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','invoice.voided','invoice.marked_uncollectible']);
export async function handleBillingWebhook(body: string, signature: string | null) {
  if (!signature) throw new BillingError('Missing signature',400);
  const {stripe,live,accountId}=billingProvider();
  let event;
  try { event=stripe.webhooks.constructEvent(body,signature,requiredConfig('FORGE_BILLING_WEBHOOK_SECRET')); }
  catch { throw new BillingError('Invalid signature',400); }
  if (event.account || event.context || event.livemode !== live) throw new BillingError('Wrong billing event account or mode',400);
  if (!EVENTS.has(event.type)) return {received:true};
  const object=event.data.object as {customer?:string|{id:string}|null};
  const customer=objectId(object.customer);
  if (!customer) return {received:true};
  const db=await getDb();
  const account=await db.prepare('SELECT * FROM forge_billing_accounts WHERE customer_id=? AND account_id=? AND livemode=?').get<BillingAccount>(customer,accountId,live ? 1 : 0);
  if (!account) return {received:true};
  if (await db.prepare('SELECT event_id FROM forge_billing_events WHERE event_id=?').get(event.id)) return {received:true};
  await reconcileCompany(account.company_id);
  await db.prepare('INSERT OR IGNORE INTO forge_billing_events(event_id,company_id) VALUES(?,?)').run(event.id,account.company_id);
  return {received:true};
}
