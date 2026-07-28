import Link from "next/link";

export const metadata = {
  title: "Support — Forge CRM",
  description:
    "Get help with Forge CRM. Contact support, browse common questions, and learn how to manage your account, subscription, and data.",
};

const LAST_UPDATED = "July 28, 2026";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-300 font-bold"
          >
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Support
        </h1>
        <p className="mt-2 text-sm text-zinc-500 font-bold">
          Last updated {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-6 text-zinc-300 leading-relaxed font-bold">
          <p>
            Forge CRM is a product of NG Ventures, LLC. This page is the
            support resource for the Forge CRM mobile app and web
            application. If you can&rsquo;t find what you need below, contact
            us and we&rsquo;ll help you directly.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Contact us
          </h2>
          <p>
            <strong className="text-white">Email:</strong>{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>
          </p>
          <p>
            <strong className="text-white">Phone:</strong>{" "}
            <a
              href="tel:+18435045474"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              (843) 504-5474
            </a>
          </p>
          <p>
            <strong className="text-white">Mailing address:</strong>
            <br />
            NG Ventures, LLC
            <br />
            2643 Great Scott Drive
            <br />
            Myrtle Beach, SC 29579
            <br />
            United States
          </p>
          <p>
            <strong className="text-white">Response times:</strong> we
            respond to support email within one business day (Monday through
            Friday, 9am–6pm Eastern Time). Urgent issues affecting billing,
            login, or messaging delivery are prioritized.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Getting started
          </h2>
          <p>
            <strong className="text-white">Create an account.</strong> Tap{" "}
            <strong className="text-white">Get Started</strong> on the sign-in
            screen or visit{" "}
            <Link
              href="/signup"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              forgecrm.app/signup
            </Link>
            . You&rsquo;ll be asked for your name, business name, email, and
            a password. No credit card is required to start.
          </p>
          <p>
            <strong className="text-white">Sign in.</strong> Open the app and
            enter the email and password you used at signup. If you forgot
            your password, tap{" "}
            <strong className="text-white">Forgot password</strong> and we
            will email you a reset link.
          </p>
          <p>
            <strong className="text-white">Invite your team.</strong> Go to{" "}
            <strong className="text-white">
              Settings → Team
            </strong>{" "}
            to invite staff by email. Each teammate gets their own login and
            can be assigned a role.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Frequently asked questions
          </h2>

          <p className="text-white pt-2">
            How do I reset my password?
          </p>
          <p>
            On the sign-in screen tap{" "}
            <strong className="text-white">Forgot password</strong>, enter
            your email, and follow the link we send you. Reset links expire
            after 60 minutes.
          </p>

          <p className="text-white pt-2">
            How do I change my email or business info?
          </p>
          <p>
            Go to <strong className="text-white">Settings → Account</strong>{" "}
            to update your email, name, phone number, and business address.
            Changes take effect immediately.
          </p>

          <p className="text-white pt-2">
            How do I cancel my subscription?
          </p>
          <p>
            Go to{" "}
            <strong className="text-white">
              Settings → Subscriptions
            </strong>{" "}
            and choose{" "}
            <strong className="text-white">Cancel subscription</strong>. Your
            plan remains active until the end of the current billing period,
            and you can re-activate any time before the period ends.
          </p>

          <p className="text-white pt-2">
            How do I delete my account or data?
          </p>
          <p>
            You can request full deletion of your account and associated data
            at any time. See our{" "}
            <Link
              href="/data-deletion"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Data Deletion Instructions
            </Link>{" "}
            for step-by-step details, or email{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>{" "}
            with the subject &ldquo;Delete my account&rdquo; from the email
            address on file. We complete deletion requests within 30 days.
          </p>

          <p className="text-white pt-2">
            How do payments work?
          </p>
          <p>
            Forge CRM uses Stripe to process customer payments. Each business
            connects its own Stripe account and funds are deposited directly
            to that account by Stripe. Forge does not hold customer funds.
            For questions about a specific charge or invoice, contact the
            business that sent it to you.
          </p>

          <p className="text-white pt-2">
            I&rsquo;m an end customer who received a message or invoice — who
            do I contact?
          </p>
          <p>
            Messages and invoices sent through Forge come from independent
            service businesses that use our platform. For questions about a
            specific appointment, message, or invoice, please contact the
            business that sent it — their name and phone number appear in the
            message or on the invoice. If you cannot identify the sender or
            need help reaching them, email{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>{" "}
            and we&rsquo;ll assist.
          </p>

          <p className="text-white pt-2">
            How do I stop receiving text messages?
          </p>
          <p>
            Reply <strong className="text-white">STOP</strong> to any text
            message you receive from the platform to unsubscribe. Opt-out is
            honored immediately. See our{" "}
            <Link
              href="/sms-terms"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              SMS Terms
            </Link>{" "}
            for full details.
          </p>

          <p className="text-white pt-2">
            What permissions does the mobile app request, and why?
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Location:</strong> used to show
              your position on the map, plan routes to appointments, and
              record door-knock activity. You can grant &ldquo;While
              Using&rdquo; permission and revoke it at any time in your
              device settings.
            </li>
            <li>
              <strong className="text-white">Camera and Photos:</strong> used
              to attach job-site photos to customer records, estimates, and
              invoices.
            </li>
            <li>
              <strong className="text-white">Contacts:</strong> optional —
              used only if you choose to import phone contacts as customers.
            </li>
            <li>
              <strong className="text-white">Notifications:</strong> used to
              alert you to new leads, incoming messages, upcoming
              appointments, and payment confirmations.
            </li>
          </ul>
          <p>
            Every permission can be changed or revoked at any time from your
            device&rsquo;s <strong className="text-white">Settings</strong>{" "}
            app.
          </p>

          <p className="text-white pt-2">
            Which devices and versions are supported?
          </p>
          <p>
            The mobile app supports iOS 16 and later on iPhone and iPad.
            The web app runs on current versions of Safari, Chrome, Firefox,
            and Edge.
          </p>

          <p className="text-white pt-2">
            I&rsquo;m having a technical problem — what should I include when
            I email?
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The email address on your account.</li>
            <li>Device and OS version (for example, iPhone 15, iOS 17.4).</li>
            <li>App version (Settings → About in the app).</li>
            <li>A short description of what you were doing.</li>
            <li>Any error message you saw, and a screenshot if possible.</li>
          </ul>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Report a bug or request a feature
          </h2>
          <p>
            Email{" "}
            <a
              href="mailto:support@forgecrm.app"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              support@forgecrm.app
            </a>{" "}
            with the subject &ldquo;Bug&rdquo; or &ldquo;Feature
            request.&rdquo; Every message reaches the product team and we
            reply to all reports.
          </p>

          <h2 className="text-xl font-extrabold tracking-tight text-white pt-4">
            Legal and privacy
          </h2>
          <p>
            <Link
              href="/terms"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Terms of Service
            </Link>
            {" · "}
            <Link
              href="/privacy"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Privacy Policy
            </Link>
            {" · "}
            <Link
              href="/sms-terms"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              SMS Terms
            </Link>
            {" · "}
            <Link
              href="/sms-consent"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              SMS Consent Disclosure
            </Link>
            {" · "}
            <Link
              href="/data-deletion"
              className="text-violet-400 hover:text-violet-300 font-extrabold"
            >
              Data Deletion
            </Link>
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-line text-sm text-zinc-500 font-bold">
          © {new Date().getFullYear()} NG Ventures, LLC · Myrtle Beach, SC ·{" "}
          <a
            href="mailto:support@forgecrm.app"
            className="hover:text-zinc-300"
          >
            support@forgecrm.app
          </a>
        </div>
      </div>
    </div>
  );
}
