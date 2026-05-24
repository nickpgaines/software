"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sms_welcome_seen";

export default function SmsWelcomeModal() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("welcome") !== "sms") return;
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
      // Already seen — strip the query param and bail.
      router.replace("/dashboard");
      return;
    }
    setOpen(true);
  }, [searchParams, router]);

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
    router.replace("/dashboard");
  }

  if (!open) return null;
  // Native fixed-inset modal wrapper kept: matches existing modal pattern in
  // this codebase (DESIGN_SYSTEM §10 #22 — only controls inside are primitives).
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-card p-8 shadow-xl">
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>
        <h2 className="text-2xl font-extrabold text-white tracking-tight text-center">
          Your account is ready to go. ✅
        </h2>
        <div className="mt-8 text-center text-zinc-300">
          <p className="font-bold text-white">Reminder:</p>
          <p className="mt-2 text-sm leading-relaxed">
            During your free trial you&apos;ll be able to send text messages
            but clients will not be able to respond. Once you upgrade to a
            paid plan and complete 10DLC registration, two-way texting will
            be enabled.
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={dismiss}
            className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-6 py-2.5 font-bold"
          >
            Proceed →
          </Button>
        </div>
        <div className="mt-6 flex justify-center gap-1.5 text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
