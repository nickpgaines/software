import SalesStatsClient from "@/components/SalesStatsClient";

export const dynamic = "force-dynamic";

export default function SalesStatsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string };
}) {
  const id = Number(params.id);
  const view = searchParams.view === "tech" ? "tech" : "sales";
  return <SalesStatsClient staffId={id} defaultView={view} />;
}
