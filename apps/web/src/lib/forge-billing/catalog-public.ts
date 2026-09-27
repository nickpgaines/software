export const BILLING_PLANS = {
  solo: { name: "Solo", seats: 1, month: 7900, year: 79000 },
  team: { name: "Team", seats: 8, month: 14900, year: 149000 },
  business: {
    name: "Business",
    seats: 30,
    month: 22900,
    year: 229000,
  },
} as const;

export type BillingPlan = keyof typeof BILLING_PLANS;
export type BillingInterval = "month" | "year";
