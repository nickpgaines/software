import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Forge CRM",
  description:
    "Terms of Service for Forge CRM, operated by NG Ventures LLC.",
};

const EFFECTIVE_DATE = "May 3, 2026";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 font-bold">
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="mt-8 space-y-6 text-zinc-300 leading-relaxed font-bold">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of
            Forge CRM (the &ldquo;Service&rdquo;), operated by NG Ventures LLC
            (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account or
            using the Service you agree to these Terms.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            1. The Service
          </h2>
          <p>
            Forge CRM is a customer-relationship and operations platform for
            service businesses. It includes scheduling, customer records,
            invoicing, payments, email, and SMS messaging features.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            2. SMS messaging program
          </h2>
          <p>
            <strong className="text-white">Program name:</strong> Forge CRM Customer Messaging.
          </p>
          <p>
            <strong className="text-white">Program description:</strong> the Service sends
            transactional, reminder, and promotional SMS messages on behalf of
            its business customers (&ldquo;Customers&rdquo;) to those
            Customers&rsquo; end consumers (&ldquo;End Users&rdquo;) who have
            opted in. Typical messages include appointment reminders, payment
            receipts, follow-up check-ins, AI-drafted replies, and seasonal
            promotional offers.
          </p>
          <p>
            <strong className="text-white">Message frequency:</strong> message frequency varies and
            depends on the Customer&rsquo;s communications. End Users typically
            receive between 2 and 10 messages per month.
          </p>
          <p>
            <strong className="text-white">Message and data rates:</strong> message and data rates may
            apply, depending on the End User&rsquo;s mobile plan.
          </p>
          <p>
            <strong className="text-white">Opt-out:</strong> reply <strong className="text-white">STOP</strong> to any message
            to unsubscribe. Opt-out is honored immediately. Other recognized
            opt-out keywords include STOPALL, UNSUBSCRIBE, CANCEL, END, and
            QUIT. To re-subscribe after opting out, reply{" "}
            <strong className="text-white">START</strong>.
          </p>
          <p>
            <strong className="text-white">Help:</strong> reply <strong className="text-white">HELP</strong> for help, or
            contact the business that originated the message directly using
            the phone number or email they provided you. You may also email{" "}
            <a
              href="mailto:nick@homeserviceascension.com"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              nick@homeserviceascension.com
            </a>
            .
          </p>
          <p>
            <strong className="text-white">Carriers:</strong> carriers (including AT&amp;T, T-Mobile,
            Verizon, and others) are not liable for delayed or undelivered
            messages.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            3. Customer accounts
          </h2>
          <p>
            Customers are responsible for the accuracy of information provided
            during signup, the security of their account credentials, and the
            actions of staff members granted access. Customers must comply
            with all applicable laws when using the Service to communicate with
            their End Users, including the Telephone Consumer Protection Act
            (TCPA), the CAN-SPAM Act, and applicable state privacy laws.
          </p>
          <p>
            Customers represent and warrant that every End User to whom they
            send messages through the Service has provided prior express
            consent to receive those messages, and that they will honor opt-out
            requests promptly.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            4. Acceptable use
          </h2>
          <p>You may not use the Service to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Send messages to recipients who have not opted in or who have
              opted out.
            </li>
            <li>
              Send unlawful, deceptive, harassing, or abusive content,
              including phishing, fraud, or content prohibited under carrier
              rules (sometimes referred to as &ldquo;SHAFT&rdquo;: sex, hate,
              alcohol, firearms, tobacco) when not explicitly permitted.
            </li>
            <li>
              Violate intellectual-property, privacy, or other legal rights of
              any third party.
            </li>
            <li>
              Attempt to circumvent rate limits, security measures, or
              authentication of the Service.
            </li>
            <li>
              Resell, sublicense, or provide the Service to third parties
              without our written consent.
            </li>
          </ul>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            5. Fees and payment
          </h2>
          <p>
            Fees and payment terms are described at signup or in a separate
            order. Fees are non-refundable except as required by law. We may
            change fees with reasonable advance notice.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            6. Privacy
          </h2>
          <p>
            Our collection and use of information is described in our{" "}
            <Link
              href="/privacy"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Privacy Policy
            </Link>
            , which is incorporated into these Terms.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            7. Termination
          </h2>
          <p>
            Either party may terminate the Service at any time. We may suspend
            or terminate accounts that violate these Terms or that pose risk
            to the Service, our other customers, or carriers. On termination,
            access to the Service ends; provisions that by their nature should
            survive (including payment, indemnification, disclaimers, and
            limitation of liability) will survive.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            8. Disclaimers
          </h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or
            implied, including merchantability, fitness for a particular
            purpose, and non-infringement. We do not warrant that messages
            will always be delivered or delivered without delay; carriers may
            block, throttle, or filter messages outside our control.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            9. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, our total aggregate
            liability arising out of or related to the Service is limited to
            the amount the Customer paid us for the Service in the 12 months
            preceding the event giving rise to the claim. We are not liable
            for indirect, incidental, special, consequential, or punitive
            damages.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            10. Indemnification
          </h2>
          <p>
            Customers will indemnify and hold us harmless from any claim,
            loss, or expense arising from their use of the Service in
            violation of these Terms, including claims by End Users related to
            messages sent without proper consent.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            11. Changes
          </h2>
          <p>
            We may update these Terms from time to time. Material changes will
            be communicated by updating the &ldquo;Effective&rdquo; date above
            and, where appropriate, by additional notice.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            12. Governing law
          </h2>
          <p>
            These Terms are governed by the laws of the State of South
            Carolina, without regard to its conflict-of-laws principles. Any
            dispute will be brought in the state or federal courts located in
            South Carolina.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            13. Contact
          </h2>
          <p>
            NG Ventures LLC
            <br />
            Email:{" "}
            <a
              href="mailto:nick@homeserviceascension.com"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              nick@homeserviceascension.com
            </a>
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-[#1f1f24] text-sm text-zinc-500 font-bold">
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
