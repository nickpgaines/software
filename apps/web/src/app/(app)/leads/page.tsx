import LeadsPipelineClient from "@/components/LeadsPipelineClient";
import { getDb, type Lead } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeadsPipelinePage() {
  const db = await getDb();
  const leads = (await db
    .prepare(
      "SELECT * FROM leads ORDER BY position ASC, created_at DESC"
    )
    .all()) as Lead[];
  return <LeadsPipelineClient initialLeads={leads} />;
}
