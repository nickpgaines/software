import EstimateDetailClient from "@/components/EstimateDetailClient";

export const dynamic = "force-dynamic";

export default function EstimatePage({ params }: { params: { id: string } }) {
  return <EstimateDetailClient id={Number(params.id)} />;
}
