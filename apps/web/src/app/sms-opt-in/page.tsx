import Link from "next/link";
import {
  buildPromotionalSmsConsentText,
  buildTransactionalSmsConsentText,
} from "@/lib/sms-consent";
import OptInSampleForm from "./OptInSampleForm";

export const metadata = {
  title: "SMS Opt-In — Forge CRM",
  description:
    "A publicly viewable sample of the SMS opt-in checkbox and disclosure that customers see when accepting a service estimate from a business using Forge CRM.",
};

export default function SmsOptInPage() {
  const transactionalConsentText = buildTransactionalSmsConsentText("Forge CRM");
  const promoConsentText = buildPromotionalSmsConsentText("Forge CRM");

  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/sms-consent"
            className="text-sm text-zinc-500 hover:text-zinc-300 font-bold"
          >
            ← SMS Consent Disclosure
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          SMS Opt-In
        </h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Forge CRM, operated by NG Ventures, LLC
        </p>

        <div className="mt-6 space-y-4 text-zinc-300 leading-relaxed font-bold">
          <p>
            Forge CRM is a software platform used by home service businesses
            (plumbing, HVAC, electrical, landscaping, and similar trades) to
            quote, schedule, and follow up on jobs. Customers receive SMS from
            the specific business they hired — appointment confirmations,
            reminders, on-the-way and arrival notifications, receipts,
            follow-ups, two-way replies, and occasional promotional or
            re-engagement messages.
          </p>
          <p>
            The form below reproduces the two SMS opt-in checkboxes a
            customer sees on every estimate — one for transactional and
            informational messages (appointment confirmations, reminders,
            on-the-way and arrival notifications, receipts, replies), and a
            separate one for marketing and promotional messages. Neither box
            is pre-selected, the boxes are independent, and neither is a
            condition of accepting the estimate or purchasing the service.
          </p>
        </div>

        <div className="mt-8 bg-card border border-line rounded-2xl shadow-sm p-6 md:p-8">
          <p className="text-xs font-bold text-zinc-500">
            Sample estimate from Forge CRM
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">
            Confirm your contact details
          </h2>
          <p className="mt-2 text-sm font-bold text-zinc-400">
            This is a sample of the form a customer fills out. No information
            is stored, no messages are sent, and submitting does not opt you
            into anything.
          </p>

          <div className="mt-6">
            <OptInSampleForm
              transactionalConsentText={transactionalConsentText}
              promoConsentText={promoConsentText}
            />
          </div>
        </div>

        <div className="mt-10 space-y-4 text-zinc-300 leading-relaxed font-bold">
          <h2 className="text-xl font-extrabold tracking-tight text-white">
            What customers consent to
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li>
              <span className="text-white">Message types:</span>{" "}
              transactional service messages (appointment confirmations,
              reminders, on-the-way and arrival notifications, receipts,
              two-way replies) and occasional promotional or re-engagement
              messages from the specific business that collected the consent.
            </li>
            <li>
              <span className="text-white">Message frequency:</span> varies
              by business and job stage. Typically 2–10 messages per month.
            </li>
            <li>
              <span className="text-white">Carrier disclaimer:</span> Message
              and data rates may apply.
            </li>
            <li>
              <span className="text-white">Opt-out:</span> reply{" "}
              <span className="text-white">STOP</span> to any message to opt
              out at any time. Opt-out is honored immediately.
            </li>
            <li>
              <span className="text-white">Help:</span> reply{" "}
              <span className="text-white">HELP</span> for assistance, or
              contact the business directly using the phone number or email
              they provided.
            </li>
            <li>
              <span className="text-white">Not a condition of purchase:</span>{" "}
              consent is optional and never required to receive a service or
              accept an estimate.
            </li>
          </ul>
          <p>
            We do not share, sell, or rent customer phone numbers or consent
            records with third parties for marketing purposes. See our{" "}
            <Link
              href="/privacy"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-line text-sm text-zinc-500 font-bold space-x-4">
          <Link href="/sms-consent" className="hover:text-zinc-300">
            SMS Consent Disclosure
          </Link>
          <Link href="/sms-terms" className="hover:text-zinc-300">
            SMS Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-zinc-300">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
