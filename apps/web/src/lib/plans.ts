// Plan definitions for SaaS-side billing of tenant companies. Each company
// has a plan_key on their company row referencing one of these. The plan
// determines included monthly outbound message volume and whether overage
// is allowed (paid, metered) or whether sends are hard-capped at the
// included quota.
//
// Numbers below are PLACEHOLDERS. Set them once you've decided pricing.
// While they're null:
//   - outboundMessagesIncluded === null → unlimited (no cap enforcement)
//   - hardCap is irrelevant when there's no cap
//   - overageRatePerMessageCents is informational only
//
// Stripe Price IDs (priceIdMonthly, priceIdMeteredOverage) come later when
// you wire up SaaS subscription billing — leave null until then.

export type Plan = {
  key: string;
  name: string;
  monthlyPriceCents: number | null;
  // Outbound messages included per calendar month. null = unlimited.
  outboundMessagesIncluded: number | null;
  // Charged per outbound message past the included quota, in cents. null
  // means there is no overage rate (combined with hardCap=true: blocks at
  // cap; with hardCap=false: passes silently when limit is null).
  overageRatePerMessageCents: number | null;
  // When true and the tenant has reached the cap, sendCompanySms returns a
  // friendly "cap reached" error rather than allowing overage.
  hardCap: boolean;
  // Stripe Price IDs — fill in once Stripe products/prices exist.
  priceIdMonthly: string | null;
  priceIdMeteredOverage: string | null;
};

export const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    monthlyPriceCents: null,
    outboundMessagesIncluded: null,
    overageRatePerMessageCents: null,
    hardCap: true,
    priceIdMonthly: null,
    priceIdMeteredOverage: null,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPriceCents: null,
    outboundMessagesIncluded: null,
    overageRatePerMessageCents: null,
    hardCap: false,
    priceIdMonthly: null,
    priceIdMeteredOverage: null,
  },
  {
    key: "premium",
    name: "Premium",
    monthlyPriceCents: null,
    outboundMessagesIncluded: null,
    overageRatePerMessageCents: null,
    hardCap: false,
    priceIdMonthly: null,
    priceIdMeteredOverage: null,
  },
];

export function getPlanByKey(key: string | null | undefined): Plan | null {
  if (!key) return null;
  return PLANS.find((p) => p.key === key) ?? null;
}
