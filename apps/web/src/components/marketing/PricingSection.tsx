"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  tag: string;
  monthly: number;
  yearly: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Solo",
    tag: "Starter",
    monthly: 99,
    yearly: 79,
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
    monthly: 229,
    yearly: 179,
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
    monthly: 379,
    yearly: 279,
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
        <div className="inline-flex items-center bg-card border border-line rounded-full p-1">
          <BillingTab active={!yearly} onClick={() => setYearly(false)}>
            Monthly
          </BillingTab>
          <BillingTab active={yearly} onClick={() => setYearly(true)}>
            Yearly
          </BillingTab>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <PlanCard key={plan.name} plan={plan} yearly={yearly} />
        ))}
      </div>
    </div>
  );
}

function BillingTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-5 rounded-full text-[13px] font-extrabold tracking-tight transition-colors inline-flex items-center",
        active ? "bg-white text-black" : "text-zinc-400 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const price = yearly ? plan.yearly : plan.monthly;
  return (
    <div
      className={cn(
        "rounded-3xl p-8 flex flex-col",
        plan.highlight
          ? "bg-white text-black border border-white"
          : "bg-card border border-line text-white",
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "text-[11px] font-extrabold tracking-[0.22em] uppercase",
            plan.highlight ? "text-black/60" : "text-zinc-500",
          )}
        >
          {plan.name}
        </div>
        {plan.highlight && (
          <span className="text-[10px] font-extrabold tracking-[0.18em] uppercase bg-black text-white rounded-full px-2.5 py-1">
            {plan.tag}
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-3 text-[14px] font-bold",
          plan.highlight ? "text-black/70" : "text-zinc-400",
        )}
      >
        {plan.blurb}
      </p>

      <div className="mt-8 flex items-baseline gap-2">
        {yearly && (
          <span
            className={cn(
              "text-[18px] font-bold line-through tabular-nums",
              plan.highlight ? "text-black/40" : "text-zinc-600",
            )}
          >
            ${plan.monthly}
          </span>
        )}
        <span className="text-[56px] font-black tracking-tight leading-none tabular-nums">
          ${price}
        </span>
        <span
          className={cn(
            "text-[14px] font-bold",
            plan.highlight ? "text-black/60" : "text-zinc-500",
          )}
        >
          /mo
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-[12px] font-bold",
          plan.highlight ? "text-black/60" : "text-zinc-500",
        )}
      >
        {yearly ? "Billed yearly" : "Billed monthly"}
      </div>

      <Button
        asChild
        className={cn(
          "mt-8 rounded-full h-11 font-extrabold tracking-tight",
          plan.highlight ? "bg-black text-white hover:bg-black/90" : "",
        )}
      >
        <Link href="/signup">Get Started</Link>
      </Button>

      <ul className="mt-8 space-y-3">
        {plan.features.map((f) => (
          <li
            key={f}
            className={cn(
              "flex items-start gap-2.5 text-[13.5px] font-bold",
              plan.highlight ? "text-black/80" : "text-zinc-300",
            )}
          >
            <CheckIcon highlight={!!plan.highlight} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon({ highlight }: { highlight: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        "w-4 h-4 flex-shrink-0 mt-0.5",
        highlight ? "text-black" : "text-white",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
