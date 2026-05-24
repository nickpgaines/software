"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const FAQ: { q: string; a: string }[] = [
  {
    q: "What are the benefits of using Forge?",
    a: "Forge replaces 5-10 separate tools — scheduling, CRM, invoicing, payments, texting, mapping, payroll — with one platform that's purpose-built for service businesses. Faster ops, better margins, less software bloat.",
  },
  {
    q: "Does Forge have a mobile app?",
    a: "Yes — full iOS and Android apps. Your reps, techs, and dispatchers can run the whole business from the phone in their pocket.",
  },
  {
    q: "Can I bring my current customers over?",
    a: "Yes. We'll import your existing customer data from a spreadsheet or your current CRM for free during onboarding.",
  },
  {
    q: "Can customers pay online through Forge?",
    a: "Yes. Stripe-powered invoices and subscription billing — customers pay by card from a branded link. Funds settle directly into your bank account.",
  },
  {
    q: "How long until we're actually live?",
    a: "Most companies are up and running the same day they sign up. Onboarding takes about 30 minutes — we'll walk you through importing data and setting up your phone number.",
  },
  {
    q: "What if I run into a problem?",
    a: "Email, text, or in-app chat support — usually replied to within an hour during business hours. Business-plan customers get priority support with same-day response SLA.",
  },
];

export function FaqSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
      {FAQ.map((item) => (
        <FaqItem key={item.q} q={item.q} a={item.a} />
      ))}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full py-5 flex items-center justify-between gap-4 text-left"
      >
        <span className="text-[15px] md:text-[16px] font-extrabold tracking-tight text-white">
          {q}
        </span>
        <span
          className={cn(
            "text-zinc-400 transition-transform flex-shrink-0",
            open && "rotate-45",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-5 text-[14px] font-bold text-zinc-400 leading-relaxed">
          {a}
        </p>
      )}
    </div>
  );
}
