import LeadsWorkflowsClient from "@/components/LeadsWorkflowsClient";
import { getDb, type LeadWorkflow, type LeadWorkflowRun } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadsWorkflowsPage() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const workflows = (await db
    .prepare(
      "SELECT * FROM lead_workflows WHERE company_id = ? ORDER BY id ASC"
    )
    .all(companyId)) as LeadWorkflow[];
  // workflow_runs are scoped via the parent workflow's company_id.
  const runs = (await db
    .prepare(
      `SELECT r.* FROM lead_workflow_runs r
         JOIN lead_workflows w ON w.id = r.workflow_id
        WHERE w.company_id = ?
        ORDER BY r.created_at DESC LIMIT 100`
    )
    .all(companyId)) as LeadWorkflowRun[];
  return <LeadsWorkflowsClient initialWorkflows={workflows} initialRuns={runs} />;
}
