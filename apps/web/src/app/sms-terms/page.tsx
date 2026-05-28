import Link from "next/link";

export const metadata = {
  title: "SMS Terms — Forge CRM",
  description:
    "SMS program terms for messages sent through Forge CRM by NG Ventures, LLC.",
};

const EFFECTIVE_DATE = "May 24, 2026";

export default function SmsTermsPage() {
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
          SMS Terms
        </h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="mt-8 space-y-6 text-zinc-300 leading-relaxed font-bold">
          <p>
            These SMS Terms describe the SMS messaging program operated by
            NG Ventures, LLC through its Forge CRM platform (the
            &ldquo;Service&rdquo;). The Service sends SMS on behalf of
            business customers (&ldquo;Businesses&rdquo;) to those
            Businesses&rsquo; own end customers (&ldquo;Recipients&rdquo;)
            who have provided express written consent to the Business.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Program name
          </h2>
          <p>Forge CRM Customer Messaging.</p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Program description
          </h2>
          <p>
            Messages sent through the Service include appointment
            confirmations and reminders, on-the-way and arrival
            notifications, payment receipts and invoices, post-service
            follow-ups, two-way customer service replies, and occasional
            promotional or re-engagement messages from the Business that
            collected the Recipient&rsquo;s consent.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            How consent is collected
          </h2>
          <p>
            Recipients provide express written consent at the point of sale
            by checking a dedicated, optional SMS consent checkbox on the
            Business&rsquo;s service estimate — separate from approving the
            estimate and never required to purchase the service. The checkbox
            names the specific Business and authorizes transactional and
            promotional SMS to the phone number the Recipient provided. Each
            opt-in is timestamped and stored per Business and is auditable on
            request. See a sample of the consent disclosure at{" "}
            <Link
              href="/sms-consent"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              /sms-consent
            </Link>
            .
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Message frequency
          </h2>
          <p>
            Message frequency varies by the Business and the Recipient&rsquo;s
            relationship with that Business. Most Recipients receive between
            2 and 10 messages per month.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Message and data rates
          </h2>
          <p>
            Message and data rates may apply, depending on the Recipient&rsquo;s
            mobile plan.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Opt-out
          </h2>
          <p>
            Recipients may opt out at any time by replying{" "}
            <strong className="text-white">STOP</strong> to any message. Other
            recognized opt-out keywords are{" "}
            <strong className="text-white">
              STOPALL, UNSUBSCRIBE, CANCEL, END,
            </strong>{" "}
            and <strong className="text-white">QUIT</strong>. Opt-out is
            honored immediately and is permanent unless the Recipient
            re-subscribes by replying{" "}
            <strong className="text-white">START</strong> or{" "}
            <strong className="text-white">YES</strong>.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Help
          </h2>
          <p>
            Recipients may reply <strong className="text-white">HELP</strong>{" "}
            or <strong className="text-white">INFO</strong> for help, or
            contact the Business that originated the message directly. For
            platform-level questions, email{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>
            .
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Sender identification
          </h2>
          <p>
            Messages identify the originating Business in the message body
            (for example, &ldquo;Acme Roofing: your appointment is
            tomorrow at 10am&rdquo;). At the carrier registration level, the
            sender is NG Ventures, LLC; messages are sent on the
            Business&rsquo;s behalf as the technical provider.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Privacy
          </h2>
          <p>
            We do not share, sell, or rent Recipient phone numbers or
            consent records with third parties or affiliates for marketing
            purposes. Full details in our{" "}
            <Link
              href="/privacy"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Carrier disclaimer
          </h2>
          <p>
            Carriers (including AT&amp;T, T-Mobile, Verizon, and others) are
            not liable for delayed or undelivered messages.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Contact
          </h2>
          <p>
            NG Ventures, LLC
            <br />
            2643 Great Scott Drive, Myrtle Beach, SC 29579
            <br />
            Email:{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>
            <br />
            Phone:{" "}
            <a
              href="tel:+18435045474"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              (843) 504-5474
            </a>
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-line text-sm text-zinc-500 font-bold space-x-4">
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-zinc-300">
            Terms of Service
          </Link>
          <Link href="/sms-consent" className="hover:text-zinc-300">
            Consent Disclosure
          </Link>
          <Link href="/sms-opt-in" className="hover:text-zinc-300">
            SMS Opt-In
          </Link>
        </div>
      </div>
    </div>
  );
}
