import EmailAutomationEditClient from "@/components/EmailAutomationEditClient";

export const dynamic = "force-dynamic";

export default async function EmailAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmailAutomationEditClient id={id} />;
}
