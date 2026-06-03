import { getDb, syncReplica, type Estimate, type EstimateItem } from "@/lib/db";
import AcceptClient from "./AcceptClient";

export const dynamic = "force-dynamic";

export default async function EstimateAcceptPage({
  params,
}: {
  params: { token: string };
}) {
  const db = await getDb();
  const lookup = () =>
    db
      .prepare("SELECT * FROM estimates WHERE accept_token = ? LIMIT 1")
      .get(params.token) as Promise<Estimate | undefined>;
  let estimate = await lookup();

  // Embedded-replica miss recovery: the rep's "send" minted the accept_token
  // and wrote it to the remote primary on a *different* serverless instance.
  // This customer-facing request can land on an instance whose local replica
  // hasn't synced that write yet (sync runs on an interval), so a fresh link
  // would wrongly read as "not found". Pull the latest and retry once before
  // giving up. See syncReplica() in @/lib/db.
  if (!estimate) {
    await syncReplica();
    estimate = await lookup();
  }

  if (!estimate) {
    return (
      <Shell>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-page-title">
          Estimate not found
        </h1>
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
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-page-title">
          Estimate accepted
        </h1>
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
