import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { getDb, type Db } from '@/lib/db';
import type { SessionContext } from '@/lib/auth';
import { resolvePermissions, type Permission } from '@/lib/permissions';
import { BILLING_PLANS, selection, validatePrices, type BillingPlan, type BillingInterval } from './catalog';
import { billingCutoff, billingOrigin, BillingError, DEFAULT_BILLING_CUTOFF, isForgeBillingEnabled, requireBillingEnabled, requiredConfig } from './config';
import { type BillingAccount, objectId, verifyProvider } from './provider';
import { readBillingAccount, reconcileCompany } from './reconcile';
export { isForgeBillingEnabled, billingCutoff } from './config';
export type BillingStatus = {
  enabled: boolean; allowed: boolean; reason: 'disabled' | 'pre_cutoff' | 'paid' | 'subscription_required'; cutoffAt: string;
  plan: BillingPlan | null; interval: BillingInterval | null; seatLimit: number | null; staffCount: number;
  paidThrough: string | null; subscriptionStatus: string | null; cancelAtPeriodEnd: boolean;
};
export async function getCompanyBillingStatus(companyId: number, now = new Date()): Promise<BillingStatus> {
  const enabled = isForgeBillingEnabled();
  const cutoffAt = enabled ? billingCutoff() : DEFAULT_BILLING_CUTOFF;
  const result: BillingStatus = { enabled, allowed: true, reason: 'disabled', cutoffAt, plan: null, interval: null, seatLimit: null, staffCount: 0, paidThrough: null, subscriptionStatus: null, cancelAtPeriodEnd: false };
  if (!enabled) return result;
  const db = await getDb();
  const row = await readBillingAccount(companyId);
  const staff = await db.prepare('SELECT COUNT(*) n FROM staff WHERE company_id=?').get<{n:number}>(companyId);
  const paid = !!row?.paid_through && ['active', 'past_due'].includes(row.subscription_status || '') && Date.parse(row.paid_through) > now.getTime();
  const before = now.getTime() < Date.parse(cutoffAt);
  return { ...result, allowed: before || paid, reason: before ? 'pre_cutoff' : paid ? 'paid' : 'subscription_required', plan: row?.plan ?? null, interval: row?.interval ?? null, seatLimit: row?.seat_limit ?? null, staffCount: staff?.n ?? 0, paidThrough: row?.paid_through ?? null, subscriptionStatus: row?.subscription_status ?? null, cancelAtPeriodEnd: !!row?.cancel_at_period_end };
}
export async function canManageBilling(session: SessionContext): Promise<boolean> {
  if (session.isPlatformAdmin) return true;
  const staff = await (await getDb()).prepare(`SELECT s.permission_level,s.custom_role_id,r.permissions FROM staff s LEFT JOIN custom_roles r ON r.id=s.custom_role_id AND r.company_id=s.company_id WHERE s.id=? AND s.company_id=?`).get<{permission_level:string;custom_role_id:number|null;permissions:string|null}>(session.staffId, session.companyId);
  if (!staff) return false;
  const custom: Permission[] | null = staff.custom_role_id ? JSON.parse(staff.permissions || '[]') : null;
  return resolvePermissions(staff.permission_level, custom).has('settings.view_all');
}
/** Call inside the staff insertion transaction; also applies while rollout is disabled. */
export async function assertCompanyNotDeleting(db: Db, companyId: number): Promise<void> {
  const account = await db.prepare('SELECT deleting FROM forge_billing_accounts WHERE company_id=?').get<{deleting:number}>(companyId);
  if (account?.deleting) throw new BillingError('Company deletion is in progress');
}
/** Call inside the transaction that authorizes organization deletion. */
export async function claimCompanyDeletion(
  db: Db,
  companyId: number
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO forge_billing_accounts(company_id,account_id,livemode,customer_key,deleting) VALUES(?,'',0,?,1)"
    )
    .run(companyId, randomUUID());
  await db
    .prepare('UPDATE forge_billing_accounts SET deleting=1 WHERE company_id=?')
    .run(companyId);
}
type Reservation = { company_id:number; reservation_id:string; plan:BillingPlan; interval:BillingInterval; price_id:string; session_id:string|null; status:string };
async function ensureCustomer(companyId: number): Promise<BillingAccount> {
  const db = await getDb();
  const existing = await readBillingAccount(companyId);
  if (existing?.deleting) throw new BillingError('Company deletion is in progress');
  if (existing) {
    if (!existing.customer_id) throw new BillingError('Customer creation needs reconciliation; contact billing support', 503);
    await verifyProvider(existing);
    return existing;
  }
  const { stripe, live, accountId } = await verifyProvider();
  const key = randomUUID();
  const claimed = await db.transaction(async tx => {
    await assertCompanyNotDeleting(tx, companyId);
    return tx.prepare('INSERT OR IGNORE INTO forge_billing_accounts(company_id,account_id,livemode,customer_key) VALUES(?,?,?,?)').run(companyId, accountId, live ? 1 : 0, key);
  });
  if (!claimed.changes) throw new BillingError('Customer creation is in progress', 503);
  // Never replay an uncertain customer creation, even after Stripe forgets its key.
  const customer = await stripe.customers.create({ metadata:{forge_company_id:String(companyId)} }, {idempotencyKey:`forge-customer-${key}`});
  if (customer.livemode !== live) throw new Error('Customer mode mismatch');
  await db.prepare('UPDATE forge_billing_accounts SET customer_id=? WHERE company_id=? AND customer_key=?').run(customer.id, companyId, key);
  return (await readBillingAccount(companyId))!;
}
async function findCheckout(account: BillingAccount, reservation: Reservation) {
  const { stripe, live } = await verifyProvider(account);
  let found: Stripe.Checkout.Session | null = reservation.session_id ? await stripe.checkout.sessions.retrieve(reservation.session_id) : null;
  if (!found) for await (const candidate of stripe.checkout.sessions.list({customer:account.customer_id!,limit:100})) {
    if (candidate.metadata?.forge_reservation_id === reservation.reservation_id) { found = candidate; break; }
  }
  if (!found) throw new BillingError('Checkout outcome is unknown. Refresh payment status or contact support.',503);
  if (found.customer !== account.customer_id || found.livemode !== live || found.metadata?.forge_reservation_id !== reservation.reservation_id) throw new Error('Checkout ownership mismatch');
  await (await getDb()).prepare('UPDATE forge_billing_checkout SET session_id=?,status=? WHERE company_id=? AND reservation_id=?').run(found.id, found.status || 'unknown', account.company_id, reservation.reservation_id);
  return found;
}
async function canRetireCheckout(
  account: BillingAccount,
  reservation: Reservation,
  checkout: Stripe.Checkout.Session,
  stripe: Stripe,
  live: boolean
): Promise<boolean> {
  if (checkout.status === 'expired') return true;
  if (checkout.status !== 'complete') return false;
  const subscriptionId = objectId(checkout.subscription);
  if (!subscriptionId) {
    throw new BillingError('Checkout subscription is unresolved', 503);
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (
    subscription.id !== subscriptionId ||
    objectId(subscription.customer) !== account.customer_id ||
    subscription.livemode !== live ||
    subscription.items.data.length !== 1 ||
    item.quantity !== 1 ||
    item.price.id !== reservation.price_id
  ) {
    throw new Error('Checkout subscription binding mismatch');
  }
  return ['canceled', 'incomplete_expired'].includes(subscription.status);
}
/**
 * Resolve canonical Checkout state before a staff insertion. The persisted row
 * may still be open (or reserved after a lost response) after provider completion.
 * The caller must delete the returned reservation inside its insertion transaction.
 */
export async function resolveTerminalCheckoutSeatRelease(
  companyId: number
): Promise<string | null> {
  if (!isForgeBillingEnabled()) return null;
  const db = await getDb();
  const reservation = await db
    .prepare('SELECT * FROM forge_billing_checkout WHERE company_id=?')
    .get<Reservation>(companyId);
  if (!reservation) return null;
  const account = await readBillingAccount(companyId);
  if (!account?.customer_id || account.deleting) {
    throw new BillingError('Checkout subscription is unresolved', 503);
  }
  try {
    const checkout = await findCheckout(account, reservation);
    const { stripe, live } = await verifyProvider(account);
    return await canRetireCheckout(account, reservation, checkout, stripe, live)
      ? reservation.reservation_id
      : null;
  } catch (error) {
    if (error instanceof BillingError) throw error;
    throw new BillingError('Checkout subscription is unresolved', 503);
  }
}
export async function createCompanyCheckout(companyId: number, rawPlan: unknown, rawInterval: unknown): Promise<{url:string}> {
  requireBillingEnabled();
  const {plan,interval} = selection(rawPlan,rawInterval);
  const origin = billingOrigin();
  const db = await getDb();
  await assertCompanyNotDeleting(db,companyId);
  const {stripe,live} = await verifyProvider();
  const prices = await validatePrices(stripe,live);
  const priceId = prices.find(p => p.plan === plan && p.interval === interval)!.id;
  const staff = await db.prepare('SELECT COUNT(*) n FROM staff WHERE company_id=?').get<{n:number}>(companyId);
  if ((staff?.n ?? 0) > BILLING_PLANS[plan].seats) throw new BillingError('This plan has fewer seats than your current employees');
  const account = await ensureCustomer(companyId);
  await reconcileCompany(companyId);
  const current = await readBillingAccount(companyId);
  if (current?.subscription_id && !['canceled','incomplete_expired'].includes(current.subscription_status || '')) throw new BillingError('Manage your existing subscription in the billing portal');
  const claim = await db.transaction(async tx => {
    await assertCompanyNotDeleting(tx,companyId);
    const count = await tx.prepare('SELECT COUNT(*) n FROM staff WHERE company_id=?').get<{n:number}>(companyId);
    if ((count?.n ?? 0) > BILLING_PLANS[plan].seats) throw new BillingError('This plan has fewer seats than your current employees');
    let reservation = await tx.prepare('SELECT * FROM forge_billing_checkout WHERE company_id=?').get<Reservation>(companyId);
    if (reservation) return {reservation,create:false};
    const id=randomUUID();
    await tx.prepare('INSERT INTO forge_billing_checkout(company_id,reservation_id,plan,interval,price_id) VALUES(?,?,?,?,?)').run(companyId,id,plan,interval,priceId);
    reservation={company_id:companyId,reservation_id:id,plan,interval,price_id:priceId,session_id:null,status:'reserved'};
    return {reservation,create:true};
  });
  const reservation = claim.reservation;
  if (!claim.create) {
    const found = await findCheckout(account,reservation);
    if (found.status === 'open' && found.url) {
      if (reservation.plan !== plan || reservation.interval !== interval) throw new BillingError('Resolve the existing Checkout before choosing another plan');
      return {url:found.url};
    }
    // The Checkout may have completed after the earlier list/reconcile. Only its
    // own canonically terminal subscription can release this reservation.
    const canRetire = await canRetireCheckout(account,reservation,found,stripe,live);
    if (canRetire) {
      await db.prepare('DELETE FROM forge_billing_checkout WHERE company_id=? AND reservation_id=? AND status=?').run(companyId,reservation.reservation_id,found.status);
      return createCompanyCheckout(companyId,plan,interval);
    }
    throw new BillingError('Checkout completed. Refresh payment status.');
  }
  const created = await stripe.checkout.sessions.create({ mode:'subscription',customer:account.customer_id!,line_items:[{price:priceId,quantity:1}],success_url:`${origin}/billing?checkout=complete`,cancel_url:`${origin}/billing`,metadata:{forge_company_id:String(companyId),forge_reservation_id:reservation.reservation_id},subscription_data:{metadata:{forge_company_id:String(companyId)}} },{idempotencyKey:`forge-checkout-${reservation.reservation_id}`});
  if (created.livemode !== live || created.customer !== account.customer_id) throw new Error('Checkout ownership mismatch');
  await db.prepare('UPDATE forge_billing_checkout SET session_id=?,status=? WHERE company_id=? AND reservation_id=?').run(created.id,created.status || 'unknown',companyId,reservation.reservation_id);
  if (!created.url) throw new BillingError('Checkout needs reconciliation',503);
  return {url:created.url};
}
export async function refreshCompanyBilling(companyId: number): Promise<BillingStatus> { requireBillingEnabled(); await reconcileCompany(companyId); return getCompanyBillingStatus(companyId); }
export async function createCompanyPortal(companyId: number): Promise<{url:string}> {
  requireBillingEnabled();
  const account=await readBillingAccount(companyId);
  if (!account?.customer_id || account.deleting) throw new BillingError('No billing account is available');
  const {stripe,live}=await verifyProvider(account);
  const configuration=requiredConfig('FORGE_BILLING_PORTAL_CONFIGURATION_ID');
  const portal=await stripe.billingPortal.configurations.retrieve(configuration);
  if (!portal.active || portal.livemode !== live || portal.features.subscription_update.enabled || !portal.features.subscription_cancel.enabled || !portal.features.payment_method_update.enabled) throw new Error('Unsafe Forge portal configuration');
  return {url:(await stripe.billingPortal.sessions.create({customer:account.customer_id,configuration,return_url:`${billingOrigin()}/billing`})).url};
}
/** Guard is durable on failure: callers must abort deletion and retry cleanup. Never call inside a DB transaction. */
export async function cancelCompanyBilling(companyId: number): Promise<void> {
  const db=await getDb();
  await db.transaction((tx) => claimCompanyDeletion(tx, companyId));
  const account=(await readBillingAccount(companyId))!;
  if (!account.account_id) return;
  if (!account.customer_id) throw new BillingError('Customer creation is unresolved; retry deletion after billing reconciliation',503);
  const {stripe}=await verifyProvider(account);
  const reservation=await db.prepare('SELECT * FROM forge_billing_checkout WHERE company_id=?').get<Reservation>(companyId);
  if (reservation) {
    const checkout=await findCheckout(account,reservation);
    if (checkout.status === 'open') await stripe.checkout.sessions.expire(checkout.id);
    else if (checkout.status === 'complete') {
      const subscriptionId=objectId(checkout.subscription);
      if (!subscriptionId) throw new BillingError('Checkout subscription is unresolved',503);
      const subscription=await stripe.subscriptions.retrieve(subscriptionId);
      if (objectId(subscription.customer) !== account.customer_id || subscription.livemode !== Boolean(account.livemode)) throw new Error('Subscription ownership mismatch');
      if (!['canceled','incomplete_expired'].includes(subscription.status)) await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false});
    } else if (checkout.status !== 'expired') throw new BillingError('Checkout is unresolved',503);
  }
  for await (const subscription of stripe.subscriptions.list({customer:account.customer_id,status:'all',limit:100})) {
    if (!['canceled','incomplete_expired'].includes(subscription.status)) await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false});
  }
  await db.prepare("UPDATE forge_billing_accounts SET paid_through=NULL,subscription_status='canceled',sync_version=sync_version+1 WHERE company_id=?").run(companyId);
}
