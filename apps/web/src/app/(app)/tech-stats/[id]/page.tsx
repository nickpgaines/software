import TechStatsClient from "@/components/TechStatsClient";

export const dynamic = "force-dynamic";

export default function TechStatsPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  return <TechStatsClient staffId={id} />;
}
