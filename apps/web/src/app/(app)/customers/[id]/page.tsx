import { notFound } from "next/navigation";
import { getDb, syncReplica, type Customer } from "@/lib/db";
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
  const sql = "SELECT * FROM customers WHERE id = ? AND company_id = ?";
  let customer = (await db.prepare(sql).get(id, companyId)) as
    | Customer
    | undefined;
  // Replica lag fallback: a brand-new customer may not be visible on this
  // instance yet. Force a sync and retry once before 404-ing.
  if (!customer) {
    await syncReplica();
    customer = (await db.prepare(sql).get(id, companyId)) as
      | Customer
      | undefined;
  }
  if (!customer) notFound();

  return <CustomerDetailClient initialCustomer={customer} />;
}
