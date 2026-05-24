import Link from "next/link";

export const metadata = {
  title: "About — Forge CRM",
  description:
    "Forge CRM is the all-in-one operations platform for home service businesses. A product of NG Ventures, LLC.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-300 font-bold"
          >
            ← Home
          </Link>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Forge CRM
        </h1>
        <p className="mt-2 text-sm text-zinc-400 font-bold">
          A product of NG Ventures, LLC
        </p>

        <p className="mt-8 text-lg text-zinc-200 leading-relaxed font-bold">
          Forge CRM is the all-in-one operations platform for home service
          businesses — scheduling, customer records, estimates, invoicing,
          payments, email, and SMS messaging in one place.
        </p>

        <div className="mt-12 space-y-8 text-zinc-300 leading-relaxed font-bold">
          <section>
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              What we do
            </h2>
            <p className="mt-3">
              Home service businesses — roofing, HVAC, plumbing, electrical,
              landscaping, pest control, window cleaning, and adjacent trades —
              use Forge CRM to run their day-to-day operations. The platform
              handles lead intake, scheduling, customer relationship
              management, estimate and invoice generation with electronic
              signature capture, payment collection, automated SMS and email
              communications, and reporting.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              SMS messaging program
            </h2>
            <p className="mt-3">
              Our business customers use Forge CRM to send transactional and
              promotional SMS to their own end customers — appointment
              reminders, on-the-way notifications, payment receipts,
              post-service follow-ups, two-way customer service replies, and
              occasional promotional or re-engagement messages.
            </p>
            <p className="mt-3">
              End-customer consent is captured at the point of sale. When a
              business customer presents a service estimate or agreement to
              their end customer, the end customer signs to accept that
              business&rsquo;s terms; those terms include an SMS consent clause
              naming the specific business and authorizing transactional and
              promotional messages. Each signed acceptance is timestamped and
              stored per business inside Forge CRM and is auditable on
              request.
            </p>
            <p className="mt-3">
              A sample of the consent disclosure end customers see is
              available at{" "}
              <Link
                href="/sms-consent"
                className="text-violet-400 hover:text-violet-300 font-extrabold"
              >
                /sms-consent
              </Link>
              . Full program details — message frequency, recognized
              keywords, message-and-data-rate disclosure, and opt-out
              process — are available at{" "}
              <Link
                href="/sms-terms"
                className="text-violet-400 hover:text-violet-300 font-extrabold"
              >
                /sms-terms
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              Company
            </h2>
            <dl className="mt-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="text-zinc-500 sm:w-32 shrink-0">Legal name</dt>
                <dd className="text-white">NG Ventures, LLC</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="text-zinc-500 sm:w-32 shrink-0">Product</dt>
                <dd className="text-white">Forge CRM</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="text-zinc-500 sm:w-32 shrink-0">Address</dt>
                <dd className="text-white">
                  2643 Great Scott Drive
                  <br />
                  Myrtle Beach, SC 29579
                  <br />
                  United States
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="text-zinc-500 sm:w-32 shrink-0">Phone</dt>
                <dd className="text-white">
                  <a
                    href="tel:+18435045474"
                    className="text-violet-400 hover:text-violet-300 font-extrabold"
                  >
                    (843) 504-5474
                  </a>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="text-zinc-500 sm:w-32 shrink-0">Email</dt>
                <dd className="text-white">
                  <a
                    href="mailto:support@forgecrm.app"
                    className="text-violet-400 hover:text-violet-300 font-extrabold"
                  >
                    support@forgecrm.app
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              Policies
            </h2>
            <ul className="mt-3 space-y-2 list-disc pl-6">
              <li>
                <Link
                  href="/privacy"
                  className="text-violet-400 hover:text-violet-300 font-extrabold"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-violet-400 hover:text-violet-300 font-extrabold"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/sms-terms"
                  className="text-violet-400 hover:text-violet-300 font-extrabold"
                >
                  SMS Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/sms-consent"
                  className="text-violet-400 hover:text-violet-300 font-extrabold"
                >
                  SMS Consent Disclosure
                </Link>
              </li>
              <li>
                <Link
                  href="/data-deletion"
                  className="text-violet-400 hover:text-violet-300 font-extrabold"
                >
                  Data Deletion Instructions
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
