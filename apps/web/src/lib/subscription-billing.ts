import "server-only";
import type Stripe from "stripe";
import {
  getDb,
  type Db,
  type Company,
  type CustomerSubscription,
  type StripePaymentMethod,
  type SubscriptionInterval,
} from "./db";
import { getStripe, getCompany } from "./stripe";
import {
  getEmailSettings,
  isEmailConfigured,
  sendEmailViaResend,
} from "./email";

// How many calendar months each interval advances. weekly/biweekly are handled
// separately as day offsets.
const MONTHS_PER_INTERVAL: Record<SubscriptionInterval, number> = {
  weekly: 0,
  biweekly: 0,
  monthly: 1,
  quarterly: 3,
  triannually: 4,
  semiannually: 6,
  yearly: 12,
};

// Advance a billing date by one interval using calendar math (not fixed-day
// approximations), so "monthly"/"quarterly"/etc. keep the same day-of-month
// and don't drift. The visit scheduler uses day approximations on purpose
// (smooth cadence); billing must not drift, hence this separate helper.
export function addBillingInterval(
  dateIso: string,
  interval: SubscriptionInterval
): string {
  const d = new Date(dateIso);
  if (interval === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
  }
  if (interval === "biweekly") {
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString();
  }
  const months = MONTHS_PER_INTERVAL[interval] || 1;
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Month overflow guard (e.g. Jan 31 + 1mo would roll into March). If the
  // day-of-month rolled forward, clamp back to the last day of the target.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString();
}

// First charge date on or after `now`, walking forward from an anchor on the
// interval cadence. Used to (re)seed next_charge_at for imported subscriptions
// so Forge resumes on the existing schedule without re-billing past periods.
export function firstChargeOnOrAfter(
  anchorIso: string,
  interval: SubscriptionInterval,
  now: Date = new Date()
): string {
  let next = new Date(anchorIso);
  if (isNaN(next.getTime())) next = new Date(now);
  // Cap iterations so a malformed anchor can never spin forever.
  for (let i = 0; i < 1200 && next.getTime() < now.getTime(); i++) {
    next = new Date(addBillingInterval(next.toISOString(), interval));
  }
  return next.toISOString();
}

export function computeTaxCents(
  priceCents: number,
  taxRateBps: number
): number {
  if (!taxRateBps || taxRateBps <= 0) return 0;
  return Math.round((priceCents * taxRateBps) / 10_000);
}

// The billing period a charge applies to, keyed by the due date (date-only).
// Drives the one-succeeded-charge-per-period idempotency guard.
function periodKeyOf(sub: CustomerSubscription): string {
  const d = sub.next_charge_at || new Date().toISOString();
  return d.slice(0, 10);
}

export type ChargeResult =
  | {
      ok: true;
      status: "charged";
      paymentId: number;
      paymentIntentId: string;
      amountCents: number;
    }
  | { ok: true; status: "already_charged" }
  | { ok: true; status: "skipped"; reason: string }
  | { ok: false; status: "no_card" }
  | { ok: false; status: "failed"; requiresAction: boolean; error: string };

/**
 * Charge a subscription's saved card off-session for one billing period.
 * Shared by the daily auto-biller cron and the manual "charge now" route so
 * both paths record identically. Idempotent per period: a period that already
 * has a succeeded attempt is never charged twice. On success it advances
 * next_charge_at by one interval and clears any past-due state; on failure it
 * marks the subscription past due, logs the attempt, and (on the first failure)
 * emails the merchant. next_charge_at is NOT advanced on failure, so the daily
 * cron keeps retrying the same period.
 */
export async function chargeSubscription(
  db: Db,
  sub: CustomerSubscription,
  opts: {
    company?: Company;
    amountCentsOverride?: number;
    advanceSchedule?: boolean;
    periodKey?: string;
  } = {}
): Promise<ChargeResult> {
  const companyId = sub.company_id;
  const company = opts.company ?? (await getCompany(companyId));
  if (!company.stripe_account_id || !company.stripe_charges_enabled) {
    return { ok: true, status: "skipped", reason: "stripe_not_ready" };
  }
  if (sub.status !== "active") {
    return { ok: true, status: "skipped", reason: `status_${sub.status}` };
  }

  const periodKey = opts.periodKey ?? periodKeyOf(sub);

  // Idempotency: never charge the same billing period twice.
  const already = await db
    .prepare(
      `SELECT id FROM subscription_charge_attempts
        WHERE subscription_id = ? AND period_key = ? AND status = 'succeeded' LIMIT 1`
    )
    .get<{ id: number }>(sub.id, periodKey);
  if (already) return { ok: true, status: "already_charged" };

  // Resolve the payment method: the subscription's locked default first, then
  // the customer's default saved card.
  let pm: StripePaymentMethod | undefined;
  if (sub.default_payment_method_id) {
    pm = await db
      .prepare(
        "SELECT * FROM stripe_payment_methods WHERE company_id = ? AND stripe_payment_method_id = ? LIMIT 1"
      )
      .get<StripePaymentMethod>(companyId, sub.default_payment_method_id);
  }
  if (!pm) {
    pm = await db
      .prepare(
        `SELECT * FROM stripe_payment_methods
          WHERE company_id = ? AND customer_id = ?
          ORDER BY is_default DESC, created_at DESC, id DESC LIMIT 1`
      )
      .get<StripePaymentMethod>(companyId, sub.customer_id);
  }
  if (!pm) return { ok: false, status: "no_card" };

  const base = Math.round(
    opts.amountCentsOverride != null &&
      Number.isFinite(Number(opts.amountCentsOverride))
      ? Number(opts.amountCentsOverride)
      : sub.price_cents
  );
  const tax = computeTaxCents(base, sub.tax_rate_bps);
  const total = base + tax;
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: true, status: "skipped", reason: "zero_amount" };
  }

  const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 50);
  const applicationFee =
    Number.isFinite(feeBps) && feeBps > 0
      ? Math.round((total * feeBps) / 10_000)
      : 0;

  const customer = await db
    .prepare("SELECT name, email FROM customers WHERE id = ? AND company_id = ?")
    .get<{ name: string | null; email: string | null }>(sub.customer_id, companyId);

  const stripe = getStripe();
  let intent: Stripe.PaymentIntent | null = null;
  let failure: {
    message: string;
    requiresAction: boolean;
    intentId?: string;
  } | null = null;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: total,
        currency: "usd",
        customer: pm.stripe_customer_id,
        payment_method: pm.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description:
          `Subscription #${sub.id} (${sub.name}) — ${customer?.name ?? ""}`.trim(),
        metadata: {
          subscription_id: String(sub.id),
          customer_id: String(sub.customer_id),
          amount_cents: String(base),
          tax_cents: String(tax),
          application_fee_cents: String(applicationFee),
          period_key: periodKey,
          source: "subscription",
        },
        receipt_email: customer?.email || undefined,
        ...(applicationFee > 0
          ? { application_fee_amount: applicationFee }
          : {}),
      },
      { stripeAccount: company.stripe_account_id }
    );
  } catch (e) {
    const err = e as {
      code?: string;
      message?: string;
      payment_intent?: { id?: string; status?: string };
    };
    failure = {
      message: err.message || "Card was declined",
      requiresAction:
        err.code === "authentication_required" ||
        err.payment_intent?.status === "requires_action",
      intentId: err.payment_intent?.id,
    };
  }

  // A returned-but-not-succeeded intent (e.g. requires_action without a throw).
  if (!failure && intent && intent.status !== "succeeded") {
    failure = {
      message: `Charge did not succeed (status: ${intent.status})`,
      requiresAction: intent.status === "requires_action",
      intentId: intent.id,
    };
  }

  if (failure) {
    const firstFailure = (sub.failed_charge_count ?? 0) === 0;
    await db.transaction(async (tx) => {
      await tx
        .prepare(
          `INSERT INTO subscription_charge_attempts
             (company_id, subscription_id, period_key, amount_cents, tax_cents,
              status, stripe_payment_intent_id, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          companyId,
          sub.id,
          periodKey,
          total,
          tax,
          failure!.requiresAction ? "requires_action" : "failed",
          failure!.intentId ?? null,
          failure!.message
        );
      await tx
        .prepare(
          `UPDATE customer_subscriptions
             SET billing_status = 'past_due',
                 failed_charge_count = failed_charge_count + 1,
                 last_charge_error = ?,
                 last_charge_attempt_at = datetime('now')
           WHERE id = ? AND company_id = ?`
        )
        .run(failure!.message, sub.id, companyId);
    });
    if (firstFailure) {
      await notifyChargeFailure(companyId, sub, failure.message).catch(() => {});
    }
    return {
      ok: false,
      status: "failed",
      requiresAction: failure.requiresAction,
      error: failure.message,
    };
  }

  // Success — record the payment + attempt, advance the schedule, clear dunning.
  const pi = intent as Stripe.PaymentIntent;
  const advanceFrom = sub.next_charge_at || new Date().toISOString();
  const nextChargeAt =
    opts.advanceSchedule === false
      ? sub.next_charge_at
      : addBillingInterval(advanceFrom, sub.interval);
  const paymentDate = new Date().toISOString().slice(0, 10);

  const paymentId = await db.transaction(async (tx) => {
    const res = await tx
      .prepare(
        `INSERT INTO payments
           (company_id, job_id, amount_cents, tip_cents, method, payment_date,
            notes, send_email, send_sms, stripe_payment_intent_id, source,
            subscription_id)
         VALUES (?, NULL, ?, 0, 'card', ?, ?, 0, 0, ?, 'subscription', ?)`
      )
      .run(
        companyId,
        total,
        paymentDate,
        `Subscription #${sub.id} charge`,
        pi.id,
        sub.id
      );
    const pid = Number(res.lastInsertRowid);
    await tx
      .prepare(
        `INSERT INTO subscription_charge_attempts
           (company_id, subscription_id, period_key, amount_cents, tax_cents,
            status, stripe_payment_intent_id, payment_id)
         VALUES (?, ?, ?, ?, ?, 'succeeded', ?, ?)`
      )
      .run(companyId, sub.id, periodKey, total, tax, pi.id, pid);
    await tx
      .prepare(
        `UPDATE customer_subscriptions
           SET last_charged_at = datetime('now'),
               last_charge_attempt_at = datetime('now'),
               billing_status = 'current',
               failed_charge_count = 0,
               last_charge_error = NULL,
               next_charge_at = ?
         WHERE id = ? AND company_id = ?`
      )
      .run(nextChargeAt, sub.id, companyId);
    return pid;
  });

  return {
    ok: true,
    status: "charged",
    paymentId,
    paymentIntentId: pi.id,
    amountCents: total,
  };
}

export type RunDueResult = {
  considered: number;
  charged: number;
  failed: number;
  skipped: number;
  no_card: number;
};

/**
 * Charge every active, auto-billing subscription whose next charge is due.
 * Past-due subscriptions are retried here too (their next_charge_at stays in
 * the past until a charge succeeds); a per-subscription throttle keeps retries
 * to ~once a day so a stuck card isn't hammered. Intended to run daily.
 */
export async function runDueSubscriptionCharges(
  opts: { now?: Date; limit?: number } = {}
): Promise<RunDueResult> {
  const db = await getDb();
  const nowIso = (opts.now ?? new Date()).toISOString();
  const due = await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE status = 'active'
          AND auto_bill = 1
          AND next_charge_at IS NOT NULL
          AND next_charge_at <= ?
          AND (last_charge_attempt_at IS NULL
               OR last_charge_attempt_at <= datetime('now', '-20 hours'))
        ORDER BY next_charge_at ASC
        LIMIT ?`
    )
    .all<CustomerSubscription>(nowIso, opts.limit ?? 200);

  const result: RunDueResult = {
    considered: due.length,
    charged: 0,
    failed: 0,
    skipped: 0,
    no_card: 0,
  };
  // Cache companies across the batch — most subs share a tenant.
  const companies = new Map<number, Company>();
  for (const sub of due) {
    let company = companies.get(sub.company_id);
    if (!company) {
      company = await getCompany(sub.company_id);
      companies.set(sub.company_id, company);
    }
    const r = await chargeSubscription(db, sub, { company });
    if (r.ok && r.status === "charged") result.charged += 1;
    else if (!r.ok && r.status === "failed") result.failed += 1;
    else if (!r.ok && r.status === "no_card") result.no_card += 1;
    else result.skipped += 1;
  }
  return result;
}

async function notifyChargeFailure(
  companyId: number,
  sub: CustomerSubscription,
  error: string
): Promise<void> {
  const db = await getDb();
  const company = await db
    .prepare("SELECT name, email FROM company WHERE id = ?")
    .get<{ name: string | null; email: string | null }>(companyId);
  if (!company?.email) return;
  const settings = await getEmailSettings(companyId);
  if (!isEmailConfigured(settings)) return;
  const cust = await db
    .prepare("SELECT name FROM customers WHERE id = ?")
    .get<{ name: string | null }>(sub.customer_id);
  const total = sub.price_cents + computeTaxCents(sub.price_cents, sub.tax_rate_bps);
  const amount = `$${(total / 100).toFixed(2)}`;
  const who = cust?.name || "a customer";
  await sendEmailViaResend({
    settings,
    to: company.email,
    subject: `Subscription payment failed — ${who}`,
    html:
      `<p>The recurring charge for <strong>${sub.name}</strong> (${who}) failed.</p>` +
      `<p>Amount: ${amount}</p><p>Reason: ${error}</p>` +
      `<p>The subscription is now marked past due and will be retried automatically.</p>`,
    text:
      `The recurring charge for ${sub.name} (${who}) failed. Amount: ${amount}. ` +
      `Reason: ${error}. Marked past due; it will be retried automatically.`,
  });
}
