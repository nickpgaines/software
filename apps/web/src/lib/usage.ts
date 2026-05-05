import { getDb } from "@/lib/db";
import { getPlanByKey, type Plan } from "@/lib/plans";

// Calendar-month period in UTC. Format: "YYYY-MM". Resets on the 1st of
// each month for every tenant simultaneously. If you later want
// per-tenant rolling 30-day windows (anchored to signup date), this is
// the seam to change — swap currentPeriod() implementation and add a
// per-row period_start/period_end pair to the schema.
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

export async function recordOutboundMessage(
  companyId: number,
  isMms = false
): Promise<void> {
  const db = await getDb();
  const period = currentPeriod();
  const mmsDelta = isMms ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO message_usage (company_id, period, outbound_count, mms_count)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(company_id, period) DO UPDATE SET
         outbound_count = outbound_count + 1,
         mms_count = mms_count + ?,
         updated_at = datetime('now')`
    )
    .run(companyId, period, mmsDelta, mmsDelta);
}

export async function recordInboundMessage(companyId: number): Promise<void> {
  const db = await getDb();
  const period = currentPeriod();
  await db
    .prepare(
      `INSERT INTO message_usage (company_id, period, inbound_count)
       VALUES (?, ?, 1)
       ON CONFLICT(company_id, period) DO UPDATE SET
         inbound_count = inbound_count + 1,
         updated_at = datetime('now')`
    )
    .run(companyId, period);
}

export type UsageStatus = {
  period: string;
  outboundCount: number;
  inboundCount: number;
  plan: Plan | null;
  capLimit: number | null;
  remaining: number | null;
  overCap: boolean;
};

export async function getUsageStatus(
  companyId: number
): Promise<UsageStatus> {
  const db = await getDb();
  const period = currentPeriod();
  const usage = (await db
    .prepare(
      "SELECT outbound_count, inbound_count FROM message_usage WHERE company_id = ? AND period = ? LIMIT 1"
    )
    .get(companyId, period)) as
    | { outbound_count: number; inbound_count: number }
    | undefined;
  const outboundCount = usage?.outbound_count ?? 0;
  const inboundCount = usage?.inbound_count ?? 0;

  const company = (await db
    .prepare("SELECT plan_key FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as { plan_key: string | null } | undefined;
  const plan = getPlanByKey(company?.plan_key);
  const capLimit = plan?.outboundMessagesIncluded ?? null;
  const remaining =
    capLimit === null ? null : Math.max(0, capLimit - outboundCount);
  const overCap = capLimit !== null && outboundCount >= capLimit;

  return {
    period,
    outboundCount,
    inboundCount,
    plan,
    capLimit,
    remaining,
    overCap,
  };
}

export type SendDecision =
  | { allow: true; markAsOverage: boolean }
  | { allow: false; reason: "hard_cap_reached" };

// Decides whether a tenant can send another outbound message. Defaults to
// allowing when there's no plan configured or the plan has no cap (the
// current placeholder state). Once you set outboundMessagesIncluded on a
// plan, this starts enforcing.
export async function decideSend(companyId: number): Promise<SendDecision> {
  const status = await getUsageStatus(companyId);
  if (!status.plan || status.capLimit === null) {
    return { allow: true, markAsOverage: false };
  }
  if (!status.overCap) {
    return { allow: true, markAsOverage: false };
  }
  if (status.plan.hardCap) {
    return { allow: false, reason: "hard_cap_reached" };
  }
  return { allow: true, markAsOverage: true };
}
