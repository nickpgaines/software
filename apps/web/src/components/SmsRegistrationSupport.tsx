"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { smsReviewSupportSummary, TWILIO_SUPPORT_URL, type SmsReviewSupport } from "@/lib/sms-review-support";

export function SmsRegistrationSupport({ details }: { details: SmsReviewSupport }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const summary = smsReviewSupportSummary(details);
  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <section aria-label="Registration review support" className="space-y-3 rounded-xl border border-line bg-black/40 p-4">
      <h4 className="text-sm font-bold text-zinc-100">Waiting on Twilio’s review</h4>
      <p className="text-sm leading-relaxed text-zinc-400">
        Your registration is awaiting Twilio’s approval. Twilio handles this review,
        and Forge cannot approve or expedite it. Since it’s taking longer than
        expected, you can contact Twilio Support for an update.
      </p>
      <p className="text-xs leading-relaxed text-zinc-500">
        {details.stage} · Last updated by Twilio: {new Date(details.lastUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild variant="secondary" size="sm">
          <a href={TWILIO_SUPPORT_URL} target="_blank" rel="noopener noreferrer">Contact Twilio Support</a>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyDetails}>Copy registration details</Button>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        Include the registration details in your request. Twilio may require sign-in
        or help from the platform account owner to access this registration.
      </p>
      <p role="status" aria-live="polite" className="text-xs text-zinc-400">
        {copyState === "copied" ? "Copied registration details." : copyState === "failed" ? "Couldn’t copy automatically. Please select and copy the details below." : ""}
      </p>
      {copyState === "failed" && (
        <textarea aria-label="Registration details to copy" readOnly value={summary} rows={10}
          className="w-full rounded-lg border border-line bg-black/40 p-3 text-xs text-zinc-300"
          onFocus={(event) => event.currentTarget.select()} />
      )}
    </section>
  );
}
