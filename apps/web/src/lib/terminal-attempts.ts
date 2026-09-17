import { createHash, randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { getDb, type Db } from '@/lib/db';
import { getStripe, getCompany, isStripeConfigured, getOrCreateStripeCustomer, savePaymentMethodForCustomer } from '@/lib/stripe';
import { TerminalError, positiveId } from '@/lib/terminal-http';
import { recordJobPayment } from '@/lib/record-job-payment';
import { terminalConsentText, TERMINAL_CONSENT_VERSION } from '@/lib/terminal-consent';

export type TerminalAttemptView = {
  attempt_id: string; operation: 'payment' | 'setup'; status: 'ready' | 'processing' | 'succeeded' | 'canceled' | 'needs_reconciliation';
  stripe_account: string; terminal_location_id: string; client_secret?: string; amount_cents: number;
  customer_id: number; job_id: number | null; save_card: boolean; payment_recorded: boolean; card_saved: boolean; warning: string | null;
};
type Attempt = Omit<TerminalAttemptView, 'stripe_account' | 'save_card' | 'payment_recorded' | 'card_saved'> & {
  company_id: number; stripe_account_id: string; stripe_customer_id: string | null; provider_intent_id: string | null;
  save_card: number; payment_recorded: number; card_saved: number; save_pending: number;
  request_fingerprint: string; consent_version: string | null; consent_name: string | null;
};
type Intent = Stripe.PaymentIntent | Stripe.SetupIntent;
function isDefinitiveAmountRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as InstanceType<typeof Stripe.errors.StripeError>;
  // Only these creation-time amount validations establish that no intent exists.
  // InvalidRequestError alone also covers errors involving existing intents.
  return e.type === 'StripeInvalidRequestError' && e.rawType === 'invalid_request_error' &&
    e.statusCode === 400 && e.param === 'amount' &&
    (e.code === 'amount_too_small' || e.code === 'amount_too_large') &&
    !e.payment_intent && !e.setup_intent && !e.charge;
}
const idOf = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id;
function view(a: Attempt, secret?: string | null): TerminalAttemptView {
  return { attempt_id: a.attempt_id, operation: a.operation, status: a.status, stripe_account: a.stripe_account_id,
    terminal_location_id: a.terminal_location_id, ...(secret && a.status === 'ready' ? { client_secret: secret } : {}),
    amount_cents: a.amount_cents, customer_id: a.customer_id, job_id: a.job_id,
    save_card: !!a.save_card, payment_recorded: !!a.payment_recorded, card_saved: !!a.card_saved, warning: a.warning };
}
async function connectedAccount(companyId: number) {
  if (!isStripeConfigured()) throw new TerminalError('Stripe is not configured', 503);
  const company = await getCompany(companyId);
  if (!company.stripe_account_id) throw new TerminalError('Complete Stripe onboarding before using Tap to Pay', 409);
  return company.stripe_account_id;
}
async function location(db: Db, companyId: number, stripeAccount: string) {
  const stripe = getStripe();
  const cached = await db.prepare('SELECT stripe_terminal_location_id FROM stripe_terminal_locations WHERE company_id=?').get<{ stripe_terminal_location_id: string }>(companyId);
  const valid = (l: Stripe.Terminal.Location) => l.address.country === 'US' && l.address.line1 && l.address.city && /^[A-Z]{2}$/.test(l.address.state || '') && /^\d{5}(-\d{4})?$/.test(l.address.postal_code || '') && l.address.postal_code !== '00000' && l.address.state !== 'NA' && l.address.city !== 'Unspecified';
  if (cached) {
    try {
      const result = await stripe.terminal.locations.retrieve(cached.stripe_terminal_location_id, undefined, { stripeAccount });
      if (!('deleted' in result) && valid(result)) return result.id;
    } catch { /* A stale cache must never authorize a reader on another account. */ }
  }
  const locations = await stripe.terminal.locations.list({ limit: 100 }, { stripeAccount });
  const candidates = locations.data.filter(valid);
  if (locations.has_more || candidates.length !== 1) throw new TerminalError('Configure a single valid US Terminal location in the connected Stripe account before using Tap to Pay.', 409);
  await db.prepare('INSERT INTO stripe_terminal_locations (company_id,stripe_terminal_location_id,display_name) VALUES (?,?,?) ON CONFLICT(company_id) DO UPDATE SET stripe_terminal_location_id=excluded.stripe_terminal_location_id,display_name=excluded.display_name').run(companyId, candidates[0].id, candidates[0].display_name);
  return candidates[0].id;
}
async function load(companyId: number, id: string) {
  const db = await getDb();
  const a = await db.prepare('SELECT * FROM terminal_attempts WHERE company_id=? AND attempt_id=?').get<Attempt>(companyId, id);
  if (!a) throw new TerminalError('Attempt not found', 404);
  if (await connectedAccount(companyId) !== a.stripe_account_id) throw new TerminalError('Stripe account changed. Restore the original account to reconcile this attempt.', 409);
  return a;
}
function validate(a: Attempt, intent: Intent) {
  const m = intent.metadata || {};
  if (m.terminal_attempt_id !== a.attempt_id || m.company_id !== String(a.company_id) || m.customer_id !== String(a.customer_id) || m.job_id !== String(a.job_id ?? '') || m.operation !== a.operation ||
      m.consent_version !== (a.consent_version || '') || m.consent_name !== (a.consent_name || '') || (a.stripe_customer_id && idOf(intent.customer) !== a.stripe_customer_id)) throw new TerminalError('Provider intent does not match this attempt', 409);
  if (a.operation === 'payment' && (!('amount' in intent) || intent.amount !== a.amount_cents || intent.currency !== 'usd' || (intent.status === 'succeeded' && intent.amount_received !== a.amount_cents))) throw new TerminalError('Provider amount does not match this attempt', 409);
}
async function retrieve(a: Attempt): Promise<Intent | null> {
  const stripe = getStripe(); const options = { stripeAccount: a.stripe_account_id };
  if (a.provider_intent_id) return a.operation === 'payment'
    ? stripe.paymentIntents.retrieve(a.provider_intent_id, { expand: ['latest_charge'] }, options)
    : stripe.setupIntents.retrieve(a.provider_intent_id, { expand: ['latest_attempt'] }, options);
  // Never reissue a creation for an unknown claim, even inside Stripe's retention window.
  // SetupIntents have no search API: scan the original customer's intents completely.
  let matches: Intent[] = [];
  if (a.operation === 'payment') {
    const result = await stripe.paymentIntents.search({ query: `metadata['terminal_attempt_id']:'${a.attempt_id}'`, limit: 100 }, options);
    if (result.has_more) return null;
    matches = result.data.filter(i => i.metadata.terminal_attempt_id === a.attempt_id);
  } else {
    if (!a.stripe_customer_id) return null;
    let after: string | undefined;
    do {
      const page = await stripe.setupIntents.list({ customer: a.stripe_customer_id, limit: 100, ...(after ? { starting_after: after } : {}) }, options);
      matches.push(...page.data.filter(i => i.metadata?.terminal_attempt_id === a.attempt_id));
      after = page.has_more ? page.data.at(-1)?.id : undefined;
    } while (after);
  }
  if (matches.length !== 1) return null;
  validate(a, matches[0]);
  await (await getDb()).prepare('UPDATE terminal_attempts SET provider_intent_id=? WHERE attempt_id=? AND provider_intent_id IS NULL').run(matches[0].id, a.attempt_id);
  a.provider_intent_id = matches[0].id;
  return retrieve(a);
}
export async function startTerminalAttempt(auth: { companyId: number; staffId: number | null }, key: string, body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TerminalError('An attempt object is required');
  if (body.operation !== 'payment' && body.operation !== 'setup') throw new TerminalError('operation must be payment or setup');
  const operation = body.operation;
  const target = positiveId(operation === 'payment' ? body.job_id : body.customer_id);
  if (operation === 'payment' && typeof body.save_card !== 'boolean') throw new TerminalError('save_card must be boolean');
  const save = operation === 'setup' || body.save_card === true;
  const c = body.consent as { accepted?: unknown; version?: unknown; customer_name?: unknown } | undefined;
  if (save && (c?.accepted !== true || c.version !== TERMINAL_CONSENT_VERSION || typeof c.customer_name !== 'string' || !c.customer_name.trim() || c.customer_name.length > 200)) throw new TerminalError('Customer consent and name are required to save a card');
  const fingerprint = createHash('sha256').update(JSON.stringify({ operation, target, save, consent: save ? { version: c!.version, name: (c!.customer_name as string).trim() } : null })).digest('hex');
  const db = await getDb();
  const stripeAccount = await connectedAccount(auth.companyId);
  const check = (a: Attempt) => {
    if (a.request_fingerprint !== fingerprint) throw new TerminalError('Idempotency key already used with different details', 409);
    if (a.stripe_account_id !== stripeAccount) throw new TerminalError('Stripe account changed', 409);
  };
  const prior = await db.prepare('SELECT * FROM terminal_attempts WHERE company_id=? AND idempotency_key=?').get<Attempt>(auth.companyId, key);
  if (prior) {
    check(prior);
    return reconcileTerminalAttempt(auth.companyId, prior.attempt_id);
  }
  // Charging eligibility gates new claims, never recovery of an existing intent.
  const company = await getCompany(auth.companyId);
  if (!company.stripe_charges_enabled) throw new TerminalError('Complete Stripe onboarding before using Tap to Pay', 409);
  const job = operation === 'payment' ? await db.prepare('SELECT customer_id FROM jobs WHERE id=? AND company_id=?').get<{ customer_id: number }>(target, auth.companyId) : null;
  if (operation === 'payment' && !job) throw new TerminalError('Job not found', 404);
  const customerId = job?.customer_id ?? target;
  if (!await db.prepare('SELECT id FROM customers WHERE id=? AND company_id=?').get(customerId, auth.companyId)) throw new TerminalError('Customer not found', 404);
  const terminalLocation = await location(db, auth.companyId, stripeAccount);
  const customer = save ? await getOrCreateStripeCustomer(auth.companyId, customerId, stripeAccount) : null;
  const merchant = company.name?.trim() || 'this merchant';
  const claim = await db.transaction(async tx => {
    const existing = await tx.prepare('SELECT * FROM terminal_attempts WHERE company_id=? AND idempotency_key=?').get<Attempt>(auth.companyId, key);
    if (existing) {
      check(existing);
      return { attempt: existing, owner: false };
    }
    let amount = 0;
    if (operation === 'payment') {
      if (await tx.prepare("SELECT attempt_id FROM terminal_attempts WHERE company_id=? AND job_id=? AND status NOT IN ('succeeded','canceled')").get(auth.companyId, target)) throw new TerminalError('Reconcile the existing payment attempt for this job first', 409);
      const balance = await tx.prepare('SELECT j.price_cents - COALESCE((SELECT SUM(amount_cents) FROM payments WHERE company_id=j.company_id AND job_id=j.id),0) AS due FROM jobs j WHERE j.id=? AND j.company_id=?').get<{ due: number }>(target, auth.companyId);
      amount = positiveId(balance?.due);
      if (amount < 50 || amount > 99_999_999) {
        throw new TerminalError('Tap to Pay requires a USD balance between $0.50 and $999,999.99.');
      }
    }
    const id = randomUUID();
    await tx.prepare(`INSERT INTO terminal_attempts (
      attempt_id,company_id,customer_id,job_id,operation,idempotency_key,request_fingerprint,
      stripe_account_id,stripe_customer_id,terminal_location_id,amount_cents,save_card,
      consent_version,consent_name,consent_at,consent_staff_id,warning
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, auth.companyId, customerId, job?.customer_id ? target : null, operation, key, fingerprint,
      stripeAccount, customer, terminalLocation, amount, save ? 1 : 0,
      save ? c!.version as string : null,
      save ? (c!.customer_name as string).trim() : null,
      save ? new Date().toISOString() : null,
      save ? auth.staffId : null,
      'Outcome unknown. Reconcile this attempt before collecting again.',
    );
    if (save) {
      await tx.prepare('UPDATE terminal_attempts SET consent_merchant=?,consent_text=? WHERE attempt_id=?').run(
        merchant, terminalConsentText(merchant), id,
      );
    }
    return { attempt: (await tx.prepare('SELECT * FROM terminal_attempts WHERE attempt_id=?').get<Attempt>(id))!, owner: true };
  });
  if (!claim.owner) return reconcileTerminalAttempt(auth.companyId, claim.attempt.attempt_id);
  const a = claim.attempt;
  const metadata = { terminal_attempt_id: a.attempt_id, company_id: String(a.company_id), customer_id: String(a.customer_id), job_id: String(a.job_id ?? ''), operation, consent_version: a.consent_version || '', consent_name: a.consent_name || '' };
  const options = { stripeAccount, idempotencyKey: `forge:terminal:${a.attempt_id}` };
  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const fee = Number.isFinite(feeBps) && feeBps > 0 ? Math.round(a.amount_cents * feeBps / 10_000) : 0;
  let intent: Intent;
  try {
    intent = operation === 'payment'
      ? await getStripe().paymentIntents.create({ amount: a.amount_cents, currency: 'usd', payment_method_types: ['card_present'], metadata, ...(fee > 0 ? { application_fee_amount: fee } : {}), ...(customer ? { customer, setup_future_usage: 'off_session' } : {}) }, options)
      : await getStripe().setupIntents.create({ customer: customer!, payment_method_types: ['card_present'], usage: 'off_session', metadata }, options);
  } catch (error) {
    if (operation === 'payment' && isDefinitiveAmountRejection(error)) {
      // A concurrent reconciliation/webhook may already have established an intent
      // or success. Release only this still-unknown, no-intent creation claim.
      await db.prepare(`UPDATE terminal_attempts SET status='canceled',warning=?,updated_at=CURRENT_TIMESTAMP
        WHERE attempt_id=? AND company_id=? AND provider_intent_id IS NULL
          AND status='needs_reconciliation' AND payment_recorded=0 AND card_saved=0`).run(
        'Stripe rejected the payment amount before creating a payment. Correct the balance before trying again.',
        a.attempt_id, a.company_id,
      );
      return view((await db.prepare('SELECT * FROM terminal_attempts WHERE attempt_id=?').get<Attempt>(a.attempt_id))!);
    }
    return view(a);
  }
  await db.prepare('UPDATE terminal_attempts SET provider_intent_id=?,updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?').run(intent.id,a.attempt_id);
  return reconcileTerminalAttempt(auth.companyId,a.attempt_id);
}
export async function reconcileTerminalAttempt(companyId: number, id: string, cancel = false, strictSave = false): Promise<TerminalAttemptView> {
  const a = await load(companyId, id); const db = await getDb();
  if (a.status === 'canceled' && !a.provider_intent_id) return view(a);
  let intent = await retrieve(a);
  if (!intent) return view(a);
  validate(a,intent);
  if ((a.status === 'succeeded' || a.status === 'canceled') && intent.status !== a.status) return view(a);
  if (cancel && ['requires_payment_method','requires_confirmation','requires_action','requires_capture'].includes(intent.status)) {
    try {
      intent = a.operation === 'payment'
        ? await getStripe().paymentIntents.cancel(intent.id, {}, { stripeAccount: a.stripe_account_id })
        : await getStripe().setupIntents.cancel(intent.id, {}, { stripeAccount: a.stripe_account_id });
    } catch { intent = await retrieve(a); if (!intent) return view(a); }
    validate(a,intent);
  }
  a.status = intent.status === 'succeeded' ? 'succeeded' : intent.status === 'canceled' ? 'canceled' : intent.status === 'processing' || intent.status === 'requires_capture' ? 'processing' : 'ready';
  a.warning = null;
  if (a.status === 'succeeded' && a.operation === 'payment') {
    await recordJobPayment({ company_id: companyId, job_id: a.job_id!, amount_cents: a.amount_cents, tip_cents: 0, method: 'card', payment_date: new Date().toISOString().slice(0,10), stripe_payment_intent_id: intent.id, idempotency_key: `terminal:${a.attempt_id}` });
    a.payment_recorded = 1;
  }
  let saveError: unknown;
  if (a.status === 'succeeded' && a.save_card && !a.card_saved) {
    const details = 'latest_charge' in intent
      ? (typeof intent.latest_charge === 'object' ? intent.latest_charge?.payment_method_details?.card_present : null)
      : (typeof intent.latest_attempt === 'object' ? intent.latest_attempt?.payment_method_details?.card_present : null);
    const generated = idOf(details?.generated_card ?? null);
    if (!generated) { a.warning = 'Card could not be saved from this tap. Use manual card entry to save a reusable card.'; a.save_pending = 0; }
    else {
      try {
        await savePaymentMethodForCustomer({ companyId, customerId: a.customer_id, stripeAccountId: a.stripe_account_id, stripePaymentMethodId: generated, requiresExplicitSelection: true });
        a.card_saved = 1; a.save_pending = 0;
      } catch (error) { a.warning = 'Payment outcome is confirmed; card saving needs reconciliation. Do not collect again.'; a.save_pending = 1; saveError = error; }
    }
  }
  const persisted = await db.transaction(async tx => {
    await tx.prepare(`UPDATE terminal_attempts SET
      status=CASE WHEN status IN ('succeeded','canceled') THEN status ELSE ? END,
      payment_recorded=MAX(payment_recorded,?),card_saved=MAX(card_saved,?),
      save_pending=CASE WHEN card_saved=1 THEN 0 ELSE ? END,
      warning=CASE WHEN card_saved=1 THEN NULL ELSE ? END,updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?`).run(a.status,a.payment_recorded,a.card_saved,a.save_pending,a.warning,a.attempt_id);
    return (await tx.prepare('SELECT * FROM terminal_attempts WHERE attempt_id=?').get<Attempt>(a.attempt_id))!;
  });
  if (saveError && strictSave && !persisted.card_saved) throw saveError;
  return view(persisted,intent.client_secret);
}
export async function listTerminalAttempts(companyId: number, target: { job_id?: number; customer_id?: number }) {
  const column = target.job_id !== undefined ? 'job_id' : 'customer_id';
  const id = positiveId(target[column]);
  const rows = await (await getDb()).prepare(`SELECT * FROM terminal_attempts WHERE company_id=? AND ${column}=? AND (status NOT IN ('succeeded','canceled') OR save_pending=1) ORDER BY created_at DESC`).all<Attempt>(companyId,id);
  return { attempts: rows.map(a => view(a)) };
}
export async function handleTerminalWebhook(intent: Intent, stripeAccount: string | undefined): Promise<boolean> {
  if (!intent.metadata?.terminal_attempt_id) return false;
  if (!stripeAccount) throw new TerminalError('Terminal webhook requires connected account',409);
  const row = await (await getDb()).prepare('SELECT * FROM terminal_attempts WHERE attempt_id=? AND stripe_account_id=?').get<Attempt>(intent.metadata.terminal_attempt_id,stripeAccount);
  if (!row) throw new TerminalError('Terminal attempt not found for webhook account',409);
  validate(row,intent);
  if (row.provider_intent_id && row.provider_intent_id !== intent.id) throw new TerminalError('Unexpected provider intent',409);
  await (await getDb()).prepare('UPDATE terminal_attempts SET provider_intent_id=? WHERE attempt_id=?').run(intent.id,row.attempt_id);
  await reconcileTerminalAttempt(row.company_id,row.attempt_id,false,true);
  return true;
}
