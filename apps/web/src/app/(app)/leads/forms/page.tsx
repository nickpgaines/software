import LeadsFormsClient from "@/components/LeadsFormsClient";
import { getDb, type LeadForm } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadsFormsPage() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const forms = (await db
    .prepare(
      "SELECT * FROM lead_forms WHERE company_id = ? ORDER BY created_at DESC"
    )
    .all(companyId)) as LeadForm[];
  return <LeadsFormsClient initialForms={forms} />;
}
