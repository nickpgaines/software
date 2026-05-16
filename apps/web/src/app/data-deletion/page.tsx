import Link from "next/link";

export const metadata = {
  title: "Data Deletion Instructions — the NG Ventures messaging platform",
  description:
    "How to request deletion of your data from the NG Ventures messaging platform, including data received from Meta / Facebook.",
};

const EFFECTIVE_DATE = "May 16, 2026";

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 font-bold">
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Data Deletion Instructions
        </h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="mt-8 space-y-6 text-zinc-300 leading-relaxed font-bold">
          <p>
            This page explains how to request deletion of personal data
            held by the NG Ventures messaging platform (the
            &ldquo;Service,&rdquo; operated by NG Ventures LLC), including
            data we received from Meta / Facebook when a business
            (&ldquo;Customer&rdquo;) connected their Facebook Page or Meta
            Business account to the Service.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Who this applies to
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">End Users</strong> &mdash; consumers whose information
              (name, phone, email, address, message history, Lead Ads form
              submissions) is stored in the Service because a Customer
              entered it or because Meta forwarded a Lead Ads submission
              to the Customer through the Service.
            </li>
            <li>
              <strong className="text-white">Customers</strong> &mdash; business account holders who
              signed up to use the Service.
            </li>
            <li>
              <strong className="text-white">Facebook users</strong> who connected the Service to
              their Facebook Page or Meta Business account and want us to
              delete the Meta-derived data we obtained through that
              connection (Page access tokens, Page metadata, ads metadata,
              and ingested Lead Ads submissions).
            </li>
          </ul>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            How to request deletion
          </h2>
          <p>
            <strong className="text-white">Option 1 &mdash; Email us.</strong> Send an email to{" "}
            <a
              href="mailto:nick@homeserviceascension.com?subject=Data%20Deletion%20Request"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              nick@homeserviceascension.com
            </a>{" "}
            with the subject line <strong className="text-white">&ldquo;Data Deletion Request&rdquo;</strong> and
            include:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your full name.</li>
            <li>
              The phone number(s) and/or email address(es) you believe
              are stored in the Service.
            </li>
            <li>
              If your data was collected through a specific business
              (Customer), the name of that business.
            </li>
            <li>
              If you are a Facebook user requesting deletion of Meta-derived
              data, your Facebook user ID or the Facebook Page name that
              was connected, so we can locate the connection.
            </li>
          </ul>
          <p>
            We will acknowledge your request within 7 days and complete
            deletion within 30 days, except where retention is required to
            comply with law, resolve disputes, or enforce our Terms. If a
            partial retention applies, we will tell you which data is
            retained and why.
          </p>

          <p>
            <strong className="text-white">Option 2 &mdash; Remove the app on Facebook.</strong> If
            you are a Facebook user who connected the Service to your
            Facebook Page or Meta Business account, you can revoke our
            access at any time:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Go to{" "}
              <a
                href="https://www.facebook.com/settings?tab=business_tools"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 font-extrabold"
              >
                Facebook Settings &rarr; Business Integrations
              </a>
              .
            </li>
            <li>
              Find <strong className="text-white">Nick360</strong> in the list and click{" "}
              <strong className="text-white">Remove</strong>.
            </li>
            <li>
              When you remove the app, Facebook revokes our access tokens
              and notifies us. We then delete the stored Meta access
              tokens and Page access tokens for that connection, and we
              delete or anonymize ingested Lead Ads submissions associated
              with that connection within 30 days.
            </li>
          </ul>
          <p>
            Removing the app on Facebook does <em>not</em> delete records
            that a Customer entered manually into their own CRM (for
            example, a customer record the Customer typed in themselves).
            To delete those records, use Option 1 and identify the
            business holding the record, or contact that business
            directly.
          </p>

          <p>
            <strong className="text-white">Option 3 &mdash; Contact the business that collected your
            information.</strong> Customers control the data in their own
            account and can delete End-User records directly. If you know
            which business collected your information, contacting them is
            usually the fastest route.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            What gets deleted
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Meta access tokens and Facebook Page access tokens stored
              for the connection.
            </li>
            <li>
              Facebook Page metadata, ads / ad-set / campaign metadata,
              and Lead Ads form submissions (name, phone, email, custom
              fields) ingested from the connected Page.
            </li>
            <li>
              On End-User request, the End User&rsquo;s personal records
              held in the Customer&rsquo;s account, including contact
              details and message history, subject to legal-retention
              exceptions described above.
            </li>
          </ul>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            What may be retained
          </h2>
          <p>
            We may retain a minimal record of the deletion request itself
            (date, scope, requester identifier) for audit purposes, and
            we may retain transaction records, opt-out records, and other
            data where retention is required by law (for example, tax,
            anti-fraud, or TCPA opt-out compliance).
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Contact
          </h2>
          <p>
            NG Ventures LLC
            <br />
            Email:{" "}
            <a
              href="mailto:nick@homeserviceascension.com?subject=Data%20Deletion%20Request"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              nick@homeserviceascension.com
            </a>
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-line text-sm text-zinc-500 font-bold flex gap-6">
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
