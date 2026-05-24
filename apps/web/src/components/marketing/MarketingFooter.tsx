import Link from "next/link";
import { ForgeMark } from "./ForgeMark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line mt-32">
      <div className="max-w-app mx-auto px-6 md:px-10 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="text-white">
              <ForgeMark />
            </div>
            <p className="text-xs font-bold text-zinc-500 mt-2">
              The CRM for service businesses that move fast.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-xs font-bold text-zinc-500">
            <Link href="/#features" className="hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-white transition-colors">
              FAQ
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-white transition-colors">
              Get Started
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-line text-xs font-bold text-zinc-600">
          © {new Date().getFullYear()} Forge. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
