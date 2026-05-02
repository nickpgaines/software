import LeadsWorkflowsClient from "@/components/LeadsWorkflowsClient";
import { getDb, type LeadWorkflow, type LeadWorkflowRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeadsWorkflowsPage() {
  const db = await getDb();
  const workflows = (await db
    .prepare("SELECT * FROM lead_workflows ORDER BY id ASC")
    .all()) as LeadWorkflow[];
  const runs = (await db
    .prepare(
      "SELECT * FROM lead_workflow_runs ORDER BY created_at DESC LIMIT 100"
    )
    .all()) as LeadWorkflowRun[];
  return <LeadsWorkflowsClient initialWorkflows={workflows} initialRuns={runs} />;
}
