import { notFound } from "next/navigation";
import LeadsWorkflowEditor from "@/components/LeadsWorkflowEditor";
import { getDb, type LeadWorkflow, type LeadWorkflowRun } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadsWorkflowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const workflow = (await db
    .prepare("SELECT * FROM lead_workflows WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as LeadWorkflow | undefined;
  if (!workflow) return notFound();
  const runs = (await db
    .prepare(
      `SELECT * FROM lead_workflow_runs WHERE workflow_id = ?
         ORDER BY id DESC LIMIT 25`
    )
    .all(id)) as LeadWorkflowRun[];
  return <LeadsWorkflowEditor initialWorkflow={workflow} initialRuns={runs} />;
}
