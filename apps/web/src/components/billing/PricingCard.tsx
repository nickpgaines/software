"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingInterval } from "@/lib/forge-billing/catalog-public";

/** Shared presentation only: each caller owns permissions, copy and actions. */
export function PricingCard({ name, description, price, period, note, highlight = false, anchor, features = [], children }: {
  name: string;
  description: string;
  price: string;
  period: string;
  note: string;
  highlight?: boolean;
  anchor?: string;
  features?: readonly string[];
  children: ReactNode;
}) {
  return (
    <article className={cn("min-w-0 rounded-3xl border p-6 xl:p-8 flex flex-col", highlight ? "bg-fg text-canvas border-fg" : "bg-card border-line text-fg")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={cn("text-[11px] font-extrabold tracking-[0.22em] uppercase", highlight ? "text-canvas opacity-60" : "text-fg-subtle")}>{name}</h3>
        {highlight && <span className="text-[10px] font-extrabold tracking-[0.18em] uppercase bg-canvas text-fg rounded-full px-2.5 py-1">Most popular</span>}
      </div>
      <p className={cn("mt-3 text-[14px] font-bold", highlight ? "text-canvas opacity-70" : "text-fg-muted")}>{description}</p>
      <div className="mt-8 flex flex-wrap items-baseline gap-2">
        {anchor && <span className={cn("text-[18px] font-bold line-through tabular-nums", highlight ? "text-canvas opacity-50" : "text-fg-subtle")}>{anchor}</span>}
        <span className="text-[44px] xl:text-[56px] font-black tracking-tight leading-none tabular-nums">{price}</span><span className={cn("text-[14px] font-bold", highlight ? "text-canvas opacity-70" : "text-fg-subtle")}>{period}</span>
      </div>
      <p className={cn("mt-3 text-xs font-bold tabular-nums", highlight ? "text-canvas opacity-70" : "text-fg-muted")}>{note}</p>
      <div className="mt-8">{children}</div>
      {features.length > 0 && <ul className="mt-8 space-y-3">
        {features.map(feature => <li key={feature} className={cn("flex items-start gap-2.5 text-[13.5px] font-bold", highlight ? "text-canvas opacity-80" : "text-fg-muted")}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <span>{feature}</span>
        </li>)}
      </ul>}
    </article>
  );
}

export function pricingActionClass(highlight: boolean) {
  return cn("w-full rounded-full h-auto min-h-11 py-3 whitespace-normal font-extrabold tracking-tight", highlight && "bg-canvas text-fg hover:bg-canvas hover:opacity-90");
}

export function BillingIntervalToggle({ value, onChange, disabled = false }: {
  value: BillingInterval | null;
  onChange(value: BillingInterval): void;
  disabled?: boolean;
}) {
  return <div role="group" aria-label="Billing frequency" className="inline-flex max-w-full items-center bg-card border border-line rounded-full p-1">
    {(["month", "year"] as const).map(choice => <Button key={choice} variant="ghost" type="button" disabled={disabled} aria-pressed={value === choice} onClick={() => onChange(choice)} className={cn("h-auto min-h-9 rounded-full px-4 py-2 text-[13px] whitespace-normal font-extrabold tracking-tight", value === choice ? "bg-fg text-canvas hover:bg-fg hover:text-canvas" : "text-fg-muted")}>
      {choice === "month" ? "Monthly" : "Annual — 2 months free"}
    </Button>)}
  </div>;
}
