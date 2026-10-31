import { PulseIcon } from "@/components/pulse/Icon";
import { isSmsTwoWayReady, type SmsRoutingStatus } from "@/lib/sms-registration-status";

export function SmsMessagingStatus({ company }: { company?: SmsRoutingStatus | null }) {
  const active = isSmsTwoWayReady(company);
  const state = company?.a2p_registration_state ?? "not_started";
  const approved = state === "campaign_approved";
  const pending = state.endsWith("_pending");
  const failed = state.endsWith("_failed");
  const badge = active ? "Two-way active" : approved ? "Number setup pending" :
    failed ? "Needs attention" : pending ? "Pending review" : "One-way only";

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-white tracking-tight">Phone &amp; Messaging</h2>
        <p className="text-sm text-zinc-400 mt-2 font-bold">
          {active ? "Two-way texting is enabled on your dedicated business number." :
            "Set up a dedicated business number to send texts and receive customer replies."}
        </p>
      </div>
      <span className={"text-xs font-bold rounded-full px-3 py-1 border whitespace-nowrap " +
        (active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
        SMS: {badge}
      </span>
    </div>
    {!active && <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/30 p-4 flex gap-3">
      <PulseIcon name="message" className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-extrabold text-white">
          {approved ? "Registration approved — number setup pending" : "Two-way texting requires registration approval"}
        </div>
        <p className="text-sm text-indigo-200/80 mt-1">
          {approved ? "Your registration is approved, but your dedicated number is not ready yet. Refresh status below to retry setup. If it still needs attention, contact support." :
            "Complete the registration below and resolve any review issues. Two-way texting becomes available once your registration is approved and your dedicated number is ready."}
        </p>
        <p className="text-sm text-indigo-200/80 mt-1">
          One-way texts use a shared number. Replies to that number do not appear in Forge.
        </p>
      </div>
    </div>}
  </>;
}
