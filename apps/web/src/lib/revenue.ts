import { getDb, type CustomerSubscription, type SubscriptionInterval } from "@/lib/db";

export const INTERVALS_PER_YEAR: Record<SubscriptionInterval, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  triannually: 3,
  semiannually: 2,
  yearly: 1,
};

export function monthlyCents(price_cents: number, interval: SubscriptionInterval): number {
  return (price_cents * INTERVALS_PER_YEAR[interval]) / 12;
}

export function annualCents(price_cents: number, interval: SubscriptionInterval): number {
  return price_cents * INTERVALS_PER_YEAR[interval];
}

export function withTax(cents: number, taxBps: number, includeTax = true): number {
  if (!includeTax || !taxBps) return cents;
  return cents * (1 + taxBps / 10000);
}

export type RevenueBuckets = {
  one_off_cents: number;
  recurring_cents: number;
  subscription_cents: number;
  tips_cents: number;
  other_cents: number;
  total_cents: number;
};

/**
 * Cash actually collected in the range, summed from `payments`.
 * Buckets are derived from `payments.source` plus `jobs.recurring`.
 */
export async function getCollectedRevenue(
  companyId: number,
  startIso: string,
  endIso: string,
): Promise<RevenueBuckets> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT p.amount_cents AS amount,
              p.tip_cents    AS tip,
              p.source       AS source,
              j.recurring    AS recurring
         FROM payments p
         LEFT JOIN jobs j ON j.id = p.job_id
        WHERE p.company_id = ?
          AND p.payment_date >= ? AND p.payment_date < ?`
    )
    .all<{ amount: number; tip: number; source: string | null; recurring: number | null }>(
      companyId,
      startIso,
      endIso,
    )) || [];

  const out: RevenueBuckets = {
    one_off_cents: 0,
    recurring_cents: 0,
    subscription_cents: 0,
    tips_cents: 0,
    other_cents: 0,
    total_cents: 0,
  };
  for (const r of rows) {
    const amount = r.amount || 0;
    const tip = r.tip || 0;
    const source = r.source || "job";
    if (source === "subscription") {
      out.subscription_cents += amount;
    } else if (source === "tip") {
      // Standalone tip rows; otherwise tips ride on a job row in tip_cents.
      out.tips_cents += amount;
    } else if (source === "other") {
      out.other_cents += amount;
    } else {
      // job
      if (r.recurring === 1) out.recurring_cents += amount;
      else out.one_off_cents += amount;
    }
    out.tips_cents += tip;
    out.total_cents += amount + tip;
  }
  return out;
}

export type GeneratedRevenue = {
  one_off_cents: number;
  recurring_jobs_cents: number;
  subscriptions_booked_arr_cents: number;
  total_cents: number;
};

/**
 * Revenue *generated* (booked / contracted) in the range. One-off and
 * recurring jobs use the job price; subscriptions use the annualized value
 * of any subscription that started in the range.
 */
export async function getGeneratedRevenue(
  companyId: number,
  startIso: string,
  endIso: string,
): Promise<GeneratedRevenue> {
  const db = await getDb();
  const jobRows = (await db
    .prepare(
      `SELECT recurring, COALESCE(SUM(price_cents), 0) AS total
         FROM jobs
        WHERE company_id = ?
          AND status != 'cancelled'
          AND scheduled_at >= ? AND scheduled_at < ?
        GROUP BY recurring`
    )
    .all<{ recurring: number | null; total: number }>(
      companyId,
      startIso,
      endIso,
    )) || [];

  let oneOff = 0;
  let recurring = 0;
  for (const r of jobRows) {
    if (r.recurring === 1) recurring += r.total || 0;
    else oneOff += r.total || 0;
  }

  const subs = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ?
          AND status IN ('active', 'canceled')
          AND COALESCE(start_date, accepted_at, created_at) >= ?
          AND COALESCE(start_date, accepted_at, created_at) < ?`
    )
    .all<CustomerSubscription>(companyId, startIso, endIso)) || [];

  let subsArr = 0;
  for (const s of subs) {
    subsArr += withTax(annualCents(s.price_cents, s.interval), s.tax_rate_bps);
  }
  subsArr = Math.round(subsArr);

  return {
    one_off_cents: oneOff,
    recurring_jobs_cents: recurring,
    subscriptions_booked_arr_cents: subsArr,
    total_cents: oneOff + recurring + subsArr,
  };
}

/** Current MRR snapshot at `asOf` (default: now). */
export async function getMRRSnapshot(
  companyId: number,
  options: { includeTax?: boolean; asOf?: Date } = {},
): Promise<number> {
  const includeTax = options.includeTax ?? true;
  const db = await getDb();
  const subs = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions
        WHERE company_id = ? AND status = 'active'`
    )
    .all<CustomerSubscription>(companyId)) || [];

  let mrr = 0;
  for (const s of subs) {
    mrr += withTax(monthlyCents(s.price_cents, s.interval), s.tax_rate_bps, includeTax);
  }
  return Math.round(mrr);
}

export type ARRAddedResult = {
  gross_added_cents: number;
  churned_cents: number;
  net_added_cents: number;
  count_started: number;
  count_canceled: number;
};

/**
 * ARR added in range. Gross = sum of annualized prices of subscriptions
 * started in range (excluding pending/declined). Churned = sum of annualized
 * prices of subscriptions that were canceled in range. Net = gross - churned.
 */
export async function getARRAdded(
  companyId: number,
  startIso: string,
  endIso: string,
  options: { includeTax?: boolean } = {},
): Promise<ARRAddedResult> {
  const includeTax = options.includeTax ?? true;
  const db = await getDb();
  const allSubs = (await db
    .prepare(`SELECT * FROM customer_subscriptions WHERE company_id = ?`)
    .all<CustomerSubscription>(companyId)) || [];

  let gross = 0;
  let churn = 0;
  let countStarted = 0;
  let countCanceled = 0;
  for (const s of allSubs) {
    if (s.status === "pending" || s.status === "declined") continue;
    const startedAt = s.start_date || s.accepted_at || s.created_at;
    if (startedAt && startedAt >= startIso && startedAt < endIso) {
      gross += withTax(annualCents(s.price_cents, s.interval), s.tax_rate_bps, includeTax);
      countStarted += 1;
    }
    if (
      s.status === "canceled" &&
      s.canceled_at &&
      s.canceled_at >= startIso &&
      s.canceled_at < endIso
    ) {
      churn += withTax(annualCents(s.price_cents, s.interval), s.tax_rate_bps, includeTax);
      countCanceled += 1;
    }
  }
  gross = Math.round(gross);
  churn = Math.round(churn);
  return {
    gross_added_cents: gross,
    churned_cents: churn,
    net_added_cents: gross - churn,
    count_started: countStarted,
    count_canceled: countCanceled,
  };
}
