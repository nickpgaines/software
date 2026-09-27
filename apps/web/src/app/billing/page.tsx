import { redirect } from "next/navigation";
import ForgeBilling from "@/components/billing/ForgeBilling";
import { isForgeBillingEnabled } from "@/lib/forge-billing/config";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  if (!isForgeBillingEnabled()) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-black px-4 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(env(safe-area-inset-top)+2rem)] text-white sm:px-6 md:px-10">
      <div className="mx-auto max-w-5xl">
        <ForgeBilling standalone />
      </div>
    </main>
  );
}
