import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Forge CRM",
  description:
    "How Forge CRM (operated by NG Ventures LLC) collects, uses, and protects your information.",
};

const EFFECTIVE_DATE = "May 3, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 font-bold">
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="mt-8 space-y-6 text-zinc-300 leading-relaxed font-bold">
          <p>
            This Privacy Policy describes how Forge CRM (the &ldquo;Service,&rdquo;
            &ldquo;we,&rdquo; or &ldquo;us&rdquo;), operated by NG Ventures LLC,
            collects, uses, and protects information about (a) businesses that
            sign up to use the Service (&ldquo;Customers&rdquo;) and (b) end
            consumers of those businesses (&ldquo;End Users&rdquo;) whose
            information is processed through the Service.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            1. Information we collect
          </h2>
          <p>
            <strong className="text-white">From Customers:</strong> business name, address, email,
            phone number, payment information processed via Stripe, and account
            usage data (logins, feature usage, audit events).
          </p>
          <p>
            <strong className="text-white">From End Users (collected on behalf of Customers):</strong>{" "}
            name, phone number, email address, service address, scheduling and
            job history, payment records, message content (SMS, email), and
            opt-in/opt-out records for messaging programs.
          </p>
          <p>
            Phone numbers and SMS opt-in records are collected at the point an
            End User provides their phone number to a Customer&mdash;for
            example, by entering it on a Customer&rsquo;s website, customer
            portal, scheduling form, or paper intake form&mdash;in order to
            receive transactional, reminder, and promotional messages from that
            Customer.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            2. How we use information
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide, operate, and improve the Service.</li>
            <li>
              To send transactional, reminder, and promotional SMS and email
              messages on behalf of Customers to their End Users, where the End
              User has opted in.
            </li>
            <li>
              To process payments, generate invoices and receipts, and prevent
              fraud.
            </li>
            <li>
              To respond to support requests, comply with legal obligations,
              and enforce our Terms.
            </li>
          </ul>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            3. SMS and consent
          </h2>
          <p>
            <strong className="text-white">
              We do not share, sell, or rent End-User phone numbers or SMS
              opt-in records with third parties or affiliates for marketing or
              promotional purposes.
            </strong>{" "}
            Phone numbers and consent records are used only to deliver messages
            from the Customer that collected them.
          </p>
          <p>
            End Users may opt out at any time by replying <strong className="text-white">STOP</strong>{" "}
            to any message; opt-out is honored immediately and is permanent
            unless the End User re-subscribes by replying <strong className="text-white">START</strong>.
            End Users may request help by replying <strong className="text-white">HELP</strong>.
            Message and data rates may apply. Message frequency varies
            (typically 2&ndash;10 messages per month per End User).
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            4. How we share information
          </h2>
          <p>
            We share information only as needed to operate the Service:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Service providers:</strong> Twilio (SMS and voice
              delivery), Stripe (payment processing), Resend (email delivery),
              Anthropic (AI-assisted message drafting), and our hosting and
              database providers. These providers process information solely
              on our instructions and are bound by confidentiality.
            </li>
            <li>
              <strong className="text-white">With the Customer:</strong> End-User information
              collected through a Customer&rsquo;s account is accessible to
              that Customer&rsquo;s authorized staff.
            </li>
            <li>
              <strong className="text-white">Legal compliance:</strong> when required by law,
              subpoena, or to protect rights and safety.
            </li>
          </ul>
          <p>
            We do not sell personal information. We do not share End-User
            information with third parties or affiliates for their own
            marketing.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            5. Data retention
          </h2>
          <p>
            We retain information for as long as the Customer&rsquo;s account is
            active and for a reasonable period thereafter to comply with legal
            obligations, resolve disputes, and enforce agreements. Customers
            and End Users may request deletion as described below.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            6. Security
          </h2>
          <p>
            We use industry-standard administrative, technical, and physical
            safeguards designed to protect information, including encryption in
            transit, secure credential storage, and access controls. No system
            is completely secure; we cannot guarantee absolute security.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            7. Your choices and rights
          </h2>
          <p>
            End Users can opt out of SMS by replying STOP. Customers can update
            account information from the Settings page or delete their account
            by contacting support. Depending on your jurisdiction, you may have
            additional rights to access, correct, or delete your information;
            contact us using the details below.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            8. Children
          </h2>
          <p>
            The Service is not directed to children under 13, and we do not
            knowingly collect information from children under 13.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            9. Changes to this policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. Material
            changes will be communicated by updating the &ldquo;Effective&rdquo;
            date above and, where appropriate, by additional notice.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            10. Contact
          </h2>
          <p>
            Questions about this policy or your information can be sent to:
          </p>
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
          <Link href="/terms" className="hover:text-zinc-300">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
