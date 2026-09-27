"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BillingIntervalToggle, PricingCard, pricingActionClass } from "@/components/billing/PricingCard";
import { BILLING_PLANS, type BillingPlan } from "@/lib/forge-billing/catalog-public";

type Plan = {
  name: string;
  tag: string;
  /** Public list price per month. Founder pricing is derived from this. */
  anchor: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Solo",
    tag: "Starter",
    anchor: 109,
    blurb: "Start solo. Scale into the next plan.",
    features: [
      "1 user",
      "Unlimited customers",
      "Scheduling & calendar",
      "Territory map",
      "Invoicing & estimates",
      "Stripe payment integration",
      "Custom SMS phone number",
      "Two-way texting",
      "Business reports",
      "Mobile app (iOS + Android)",
    ],
  },
  {
    name: "Team",
    tag: "Most popular",
    anchor: 219,
    blurb: "More reps. More doors. More revenue.",
    features: [
      "Up to 8 users",
      "Everything in Solo, plus:",
      "Custom roles and permissions",
      "Leaderboard",
      "Sales pipeline (Kanban)",
      "Recurring subscriptions",
      "Mass marketing messages",
      "Salesperson performance tracking",
      "Employee dispatch notifications",
    ],
    highlight: true,
  },
  {
    name: "Business",
    tag: "Scale",
    anchor: 329,
    blurb: "For scaled operations.",
    features: [
      "Up to 30 users",
      "Everything in Team, plus:",
      "Payroll tracking",
      "Equipment logs",
      "Expense tracking",
      "Advanced reporting",
      "API access + Zapier",
      "Priority support",
    ],
  },
];

export function PricingSection() {
  const [yearly, setYearly] = useState(true);

  return (
    <div>
      <div className="flex justify-center">
        <BillingIntervalToggle value={yearly ? "year" : "month"} onChange={value => setYearly(value === "year")} />
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <PlanCard key={plan.name} plan={plan} yearly={yearly} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const details = BILLING_PLANS[plan.name.toLowerCase() as BillingPlan];
  const price = yearly ? Math.round(details.year / 1200) : details.month / 100;
  const annual = (details.year / 100).toLocaleString("en-US");
  return (
    <PricingCard
      name={plan.name}
      description={plan.blurb}
      highlight={plan.highlight}
      anchor={`$${plan.anchor}`}
      price={`$${price}`}
      period="/mo"
      note={yearly ? `Founder price · $${annual} billed yearly` : "Founder price · billed monthly"}
      features={plan.features}
    >
      <Button asChild className={pricingActionClass(!!plan.highlight)}>
        <Link href="/signup">Get Started</Link>
      </Button>
    </PricingCard>
  );
}
