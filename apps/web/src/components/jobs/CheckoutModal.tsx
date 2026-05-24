"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CheckoutChoice = "tap_to_pay" | "card" | "other";

declare global {
  interface Window {
    ForgeNative?: {
      startTapToPay?: (args: {
        jobId: number;
        amountCents: number;
      }) => void;
    };
  }
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CheckoutModal({
  jobId,
  jobTotalCents,
  paidTotalCents,
  onClose,
  onChoose,
}: {
  jobId: number;
  jobTotalCents: number;
  paidTotalCents: number;
  onClose: () => void;
  onChoose: (choice: CheckoutChoice) => void;
}) {
  const [tapNotice, setTapNotice] = useState<string | null>(null);
  const dueCents = Math.max(0, jobTotalCents - paidTotalCents);

  function handleTapToPay() {
    setTapNotice(null);
    const bridge =
      typeof window !== "undefined" ? window.ForgeNative : undefined;
    if (bridge?.startTapToPay) {
      bridge.startTapToPay({ jobId, amountCents: dueCents });
      onChoose("tap_to_pay");
      return;
    }
    setTapNotice(
      "Tap to Pay on iPhone runs through the Forge iOS app (coming soon). Use Pay with card to charge a card from this device."
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-extrabold text-white tracking-tight">
            Checkout
          </h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto p-0 text-zinc-500 hover:text-zinc-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </Button>
        </div>

        <div className="p-5 space-y-5">
          <div className="border border-line rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 font-bold">Job total</span>
              <span className="text-white font-extrabold tabular-nums">
                {money(jobTotalCents)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 font-bold">Amount paid</span>
              <span className="text-white font-bold tabular-nums">
                {money(paidTotalCents)}
              </span>
            </div>
            <div className="h-px bg-line my-1" />
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-bold">Total due</span>
              <span className="text-white font-extrabold text-lg tabular-nums">
                {money(dueCents)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="ghost"
              type="button"
              onClick={handleTapToPay}
              className="w-full h-auto bg-primary hover:opacity-90 text-primary-foreground rounded-2xl px-4 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2"
            >
              <TapIcon />
              <span>Tap to Pay on iPhone</span>
            </Button>

            {tapNotice && (
              <p className="text-xs text-amber-500 font-bold leading-snug">
                {tapNotice}
              </p>
            )}

            <Divider label="or" />

            <Button
              variant="ghost"
              type="button"
              onClick={() => onChoose("card")}
              className="w-full h-auto border border-line bg-card hover:bg-black text-white rounded-2xl px-4 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2"
            >
              <CardIcon />
              <span>Pay with card</span>
            </Button>

            <Divider label="or pay with" />

            <Button
              variant="ghost"
              type="button"
              onClick={() => onChoose("other")}
              className="w-full h-auto border border-line bg-card hover:bg-black text-zinc-300 rounded-2xl px-4 py-3 text-sm font-extrabold inline-flex items-center justify-center"
            >
              Other
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 h-px bg-line" />
      <span className="text-xs text-zinc-500 font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="flex-1 h-px bg-line" />
    </div>
  );
}

function TapIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="2.5" width="10" height="19" rx="2" />
      <path d="M7 19h2" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" opacity="0.55" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  );
}
