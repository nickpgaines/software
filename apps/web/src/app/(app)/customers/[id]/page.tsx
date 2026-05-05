import { notFound } from "next/navigation";
import { getDb, type Customer } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import CustomerDetailClient from "@/components/customers/CustomerDetailClient";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = await requireCompanyId();
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const db = await getDb();
  const customer = (await db
    .prepare("SELECT * FROM customers WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Customer | undefined;
  if (!customer) notFound();

  return <CustomerDetailClient initialCustomer={customer} />;
}
