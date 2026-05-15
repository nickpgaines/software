import InvoiceDetailClient from "@/components/InvoiceDetailClient";

export const dynamic = "force-dynamic";

export default function InvoicePage({ params }: { params: { id: string } }) {
  return <InvoiceDetailClient id={Number(params.id)} />;
}
