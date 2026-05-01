import EmailDetailClient from "@/components/EmailDetailClient";

export const dynamic = "force-dynamic";

export default function EmailDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <EmailDetailClient id={Number(params.id)} />;
}
