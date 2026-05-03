import LeadsPipelineClient from "@/components/LeadsPipelineClient";
import { getDb, type Lead } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadsPipelinePage() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const leads = (await db
    .prepare(
      "SELECT * FROM leads WHERE company_id = ? ORDER BY position ASC, created_at DESC"
    )
    .all(companyId)) as Lead[];
  return <LeadsPipelineClient initialLeads={leads} />;
}
