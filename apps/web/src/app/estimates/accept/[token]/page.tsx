import { getDb, type Estimate, type EstimateItem } from "@/lib/db";
import { buildSmsConsentText } from "@/lib/sms-consent";
import AcceptClient from "./AcceptClient";

export const dynamic = "force-dynamic";

export default async function EstimateAcceptPage({
  params,
}: {
  params: { token: string };
}) {
  const db = await getDb();
  const estimate = (await db
    .prepare("SELECT * FROM estimates WHERE accept_token = ? LIMIT 1")
    .get(params.token)) as Estimate | undefined;

  if (!estimate) {
    return (
      <Shell>
        <h1 className="text-page-title text-white">Estimate not found</h1>
        <p className="mt-3 text-sm font-bold text-zinc-400">
          This link may be incorrect, or the estimate was removed.
        </p>
      </Shell>
    );
  }

  const company = (await db
    .prepare("SELECT name FROM company WHERE id = ? LIMIT 1")
    .get(estimate.company_id)) as { name: string | null } | undefined;
  const companyName = company?.name?.trim() || "this business";

  if (estimate.status === "accepted") {
    return (
      <Shell>
        <div className="mb-2 text-2xl text-emerald-500">✓</div>
        <h1 className="text-page-title text-white">Estimate accepted</h1>
        <p className="mt-3 text-sm font-bold text-zinc-400">
          Thanks
          {estimate.signature_name ? `, ${estimate.signature_name}` : ""} —{" "}
          {companyName} has been notified. You can close this window.
        </p>
      </Shell>
    );
  }

  const items = (await db
    .prepare(
      "SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY position ASC, id ASC"
    )
    .all(estimate.id)) as EstimateItem[];

  return (
    <Shell wide>
      <AcceptClient
        token={params.token}
        companyName={companyName}
        terms={estimate.terms}
        consentText={buildSmsConsentText(companyName)}
        total={estimate.total_cents}
        items={items.map((it) => ({
          id: it.id,
          title: it.title,
          description: it.description,
          quantity: it.quantity,
          price_cents: it.price_cents,
        }))}
      />
    </Shell>
  );
}

function Shell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div
        className={`bg-card border border-line rounded-2xl shadow-sm p-8 w-full ${
          wide ? "max-w-lg" : "max-w-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
