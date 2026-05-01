import { getDb, type Invoice } from "@/lib/db";
import PayClient from "./PayClient";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function InvoicePayPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { status?: string };
}) {
  const db = await getDb();
  const invoice = (await db
    .prepare("SELECT * FROM invoices WHERE stripe_pay_token = ? LIMIT 1")
    .get(params.token)) as Invoice | undefined;

  const company = (await db
    .prepare("SELECT name FROM company WHERE id = 1")
    .get()) as { name: string | null } | undefined;
  const companyName = company?.name?.trim() || "the merchant";

  if (!invoice) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">Invoice not found</h1>
        <p className="text-sm text-slate-600 mt-2">
          The link you followed may be incorrect, or this invoice was deleted.
        </p>
      </Shell>
    );
  }

  if (invoice.status === "paid" || searchParams.status === "success") {
    return (
      <Shell>
        <div className="text-emerald-600 mb-2">✓</div>
        <h1 className="text-xl font-semibold text-slate-900">
          Payment received
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Thanks — {companyName} has been notified. You can close this window.
        </p>
      </Shell>
    );
  }

  if (invoice.status === "void") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">
          Invoice no longer valid
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          This invoice has been voided by {companyName}. If you think this is a
          mistake, reach out to them directly.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-wide text-slate-400">
        Invoice from {companyName}
      </p>
      <h1 className="text-2xl font-semibold text-slate-900 mt-1">
        {invoice.title?.trim() || `Invoice #${invoice.id}`}
      </h1>
      <div className="mt-6 flex items-end justify-between gap-3 border-t border-slate-200 pt-4">
        <span className="text-sm text-slate-500">Amount due</span>
        <span className="text-2xl font-semibold text-slate-900 tabular-nums">
          {money(invoice.total_cents - invoice.paid_cents)}
        </span>
      </div>
      {invoice.due_date && (
        <p className="mt-1 text-xs text-slate-500 text-right">
          Due {invoice.due_date}
        </p>
      )}
      <PayClient
        token={params.token}
        cancelled={searchParams.status === "cancel"}
      />
      <p className="mt-6 text-xs text-slate-400 text-center">
        Payments are processed securely by Stripe.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
