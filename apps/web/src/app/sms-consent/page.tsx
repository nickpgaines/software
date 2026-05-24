import Link from "next/link";

export const metadata = {
  title: "SMS Consent Disclosure — Forge CRM",
  description:
    "How end customers provide express written consent to receive SMS from businesses using Forge CRM.",
};

const EFFECTIVE_DATE = "May 24, 2026";

export default function SmsConsentDisclosurePage() {
  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/about"
            className="text-sm text-zinc-500 hover:text-zinc-300 font-bold"
          >
            ← About
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          SMS Consent Disclosure
        </h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="mt-8 space-y-6 text-zinc-300 leading-relaxed font-bold">
          <p>
            This page describes how end customers (&ldquo;Recipients&rdquo;)
            provide express written consent to receive SMS from home service
            businesses (&ldquo;Businesses&rdquo;) that use Forge CRM,
            operated by NG Ventures, LLC, to send messages on their behalf.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Where consent is collected
          </h2>
          <p>
            Consent is collected at the point of sale, inside the Business&rsquo;s
            service estimate or agreement. When a Business presents an
            estimate to a Recipient — typically in person, on a tablet during
            the on-site sale of a service — the Recipient reviews the
            estimate&rsquo;s terms and signs to accept them. Those terms
            include an SMS consent clause that names the specific Business
            and authorizes the categories of SMS the Recipient is
            consenting to.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            What the Recipient sees and signs
          </h2>
          <p>
            The following text appears in the signed estimate. The placeholder{" "}
            <em>{"{Business Name}"}</em> is replaced with the legal or
            trade name of the Business presenting the estimate:
          </p>
          <blockquote className="border-l-4 border-violet-500 pl-4 py-2 my-4 bg-zinc-950/60 text-zinc-200 italic">
            Communications consent. By approving this estimate, you authorize{" "}
            <strong className="text-white not-italic">
              {"{Business Name}"}
            </strong>{" "}
            to contact you by phone and text message (SMS) at the number you
            provided, including service messages (scheduling, reminders,
            receipts, follow-ups) and occasional promotional or
            re-engagement messages. Message frequency varies. Message and
            data rates may apply. Reply{" "}
            <strong className="text-white not-italic">STOP</strong> to opt
            out at any time, or{" "}
            <strong className="text-white not-italic">HELP</strong> for help.
            Consent is not a condition of purchase.
          </blockquote>
          <p>
            The Recipient affirmatively signs the estimate to accept its
            terms in their entirety, including the SMS consent clause
            above. Consent is voluntary — Recipients may decline the
            estimate or strike the clause prior to signing, and the
            Business is required to honor that.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            How consent is recorded
          </h2>
          <p>
            Each signed estimate is stored inside Forge CRM with the
            timestamp of acceptance, the Recipient&rsquo;s identifying
            information, the originating Business, the IP address from
            which the signature was captured, and the exact text the
            Recipient agreed to (including the SMS consent clause as
            rendered above with the Business name filled in). These records
            are produced on request in response to a carrier audit, a
            regulatory inquiry, or a consumer dispute.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            What consent covers
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Transactional and service:</strong>{" "}
              appointment confirmations, reminders, on-the-way and arrival
              notifications, payment receipts, invoice notices,
              post-service follow-ups, and two-way customer service
              replies.
            </li>
            <li>
              <strong className="text-white">Promotional and re-engagement:</strong>{" "}
              occasional offers, seasonal service reminders, and
              re-engagement messages from the Business that collected the
              Recipient&rsquo;s consent.
            </li>
          </ul>
          <p>
            Consent does <em>not</em> authorize messages from any business
            other than the one that collected it. Each Recipient&rsquo;s
            consent runs only to the Business the Recipient hired.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Opting out
          </h2>
          <p>
            Recipients may opt out at any time by replying{" "}
            <strong className="text-white">STOP</strong> to any message.
            Opt-out is honored immediately and is permanent unless the
            Recipient re-subscribes by replying{" "}
            <strong className="text-white">START</strong>. Recipients may
            also contact the Business directly to be removed. Recipients may
            reply <strong className="text-white">HELP</strong> for support.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Privacy and sharing
          </h2>
          <p>
            We do not share, sell, or rent Recipient phone numbers or
            consent records with third parties or affiliates for marketing
            purposes. Phone numbers and consent records are used only to
            deliver messages from the Business that collected them. Full
            details in our{" "}
            <Link
              href="/privacy"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Questions
          </h2>
          <p>
            For platform-level questions about how Forge CRM handles SMS
            consent, contact NG Ventures, LLC at{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>{" "}
            or{" "}
            <a
              href="tel:+18435045474"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              (843) 504-5474
            </a>
            . For questions about the messages a specific Business is
            sending you, contact that Business directly using the phone
            number or email they provided.
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-line text-sm text-zinc-500 font-bold space-x-4">
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
