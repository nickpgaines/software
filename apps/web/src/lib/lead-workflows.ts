import { getDb, type Lead, type LeadWorkflow, type LeadWorkflowRun } from "@/lib/db";
import { sendCompanySms, normalizeUSPhone } from "@/lib/sms";
import {
  parseSteps,
  type WorkflowStep,
  type WorkflowTrigger,
} from "@/lib/lead-workflows-types";

export {
  WORKFLOW_TRIGGERS,
  WORKFLOW_TEMPLATES,
  STEP_TYPES,
  defaultStep,
  parseSteps,
} from "@/lib/lead-workflows-types";
export type {
  WorkflowTrigger,
  WorkflowStep,
  WorkflowStepType,
  WorkflowTemplate,
} from "@/lib/lead-workflows-types";

function applyVars(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => {
    const v = vars[key.toLowerCase()];
    return v == null ? "" : String(v);
  });
}

async function leadVars(
  companyId: number,
  lead: Lead
): Promise<Record<string, string>> {
  const db = await getDb();
  const company = await db
    .prepare("SELECT name, phone FROM company WHERE id = ?")
    .get<{ name: string | null; phone: string | null }>(companyId);
  return {
    first_name: lead.first_name || "",
    last_name: lead.last_name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    address: lead.address || "",
    company_name: company?.name || "",
  };
}

const STAGE_TIMESTAMP: Record<string, string | null> = {
  new: null,
  contacted: "contacted_at",
  responded: "responded_at",
  estimate_sent: "estimate_sent_at",
};

// Enqueue workflow_runs for every enabled workflow on this company that
// matches the given trigger, then immediately advance any zero-delay
// leading steps so the user sees instant action (the daily cron only
// catches longer-delayed steps after the fact). Safe to call from API
// routes — failures here must never break the originating action.
export async function fireTrigger(args: {
  companyId: number;
  leadId: number;
  trigger: WorkflowTrigger;
}): Promise<void> {
  try {
    const { companyId, leadId, trigger } = args;
    const db = await getDb();
    const workflows = (await db
      .prepare(
        `SELECT * FROM lead_workflows
           WHERE company_id = ? AND enabled = 1 AND trigger = ?`
      )
      .all(companyId, trigger)) as LeadWorkflow[];
    let enrolled = false;
    for (const wf of workflows) {
      const steps = parseSteps(wf.steps);
      if (steps.length === 0) continue;
      // Don't double-enroll an active run for the same workflow + lead.
      const existing = await db
        .prepare(
          `SELECT id FROM lead_workflow_runs
             WHERE workflow_id = ? AND lead_id = ? AND status = 'pending'
             LIMIT 1`
        )
        .get<{ id: number }>(wf.id, leadId);
      if (existing) continue;
      await db
        .prepare(
          `INSERT INTO lead_workflow_runs
             (workflow_id, lead_id, status, step_index, last_step_at)
           VALUES (?, ?, 'pending', 0, datetime('now'))`
        )
        .run(wf.id, leadId);
      enrolled = true;
    }
    if (enrolled) {
      // Drain immediately so the first SMS / stage-update fires on the
      // originating request, not on the next daily cron tick.
      await runPendingWorkflowSteps().catch((e) => {
        console.error("[lead-workflows] inline drain failed", e);
      });
    }
  } catch (err) {
    console.error("[lead-workflows] fireTrigger failed", err);
  }
}

// Execute one step on one run, return true if we should immediately try the
// next step (non-delay actions advance instantly). For delay steps, returns
// false (we wait for the cron to come back around).
async function executeStep(
  run: LeadWorkflowRun,
  step: WorkflowStep,
  lead: Lead,
  companyId: number
): Promise<{ advanced: boolean; immediate: boolean; error?: string }> {
  const db = await getDb();
  const vars = await leadVars(companyId, lead);

  if (step.type === "delay") {
    // Check whether enough time has elapsed since last_step_at.
    const lastIso = run.last_step_at || run.created_at;
    const lastMs = new Date(lastIso + "Z").getTime();
    const nowMs = Date.now();
    if (Number.isNaN(lastMs)) {
      // Fall through and treat as ready — bad timestamps shouldn't strand runs.
      await db
        .prepare(
          `UPDATE lead_workflow_runs
             SET step_index = step_index + 1,
                 last_step_at = datetime('now')
           WHERE id = ?`
        )
        .run(run.id);
      return { advanced: true, immediate: true };
    }
    const elapsedMin = (nowMs - lastMs) / 60000;
    if (elapsedMin < step.minutes) {
      return { advanced: false, immediate: false };
    }
    await db
      .prepare(
        `UPDATE lead_workflow_runs
           SET step_index = step_index + 1,
               last_step_at = datetime('now')
         WHERE id = ?`
      )
      .run(run.id);
    return { advanced: true, immediate: true };
  }

  if (step.type === "send_sms") {
    if (!lead.phone) {
      return { advanced: true, immediate: true, error: "Lead has no phone" };
    }
    const to = normalizeUSPhone(lead.phone) || lead.phone;
    const body = applyVars(step.message, vars);
    const result = await sendCompanySms({ companyId, to, body });
    if (!result.ok) {
      await db
        .prepare(
          `UPDATE lead_workflow_runs
             SET status = 'failed', error = ?, last_step_at = datetime('now')
           WHERE id = ?`
        )
        .run(result.error, run.id);
      return { advanced: false, immediate: false, error: result.error };
    }
    // Mirror outbound into messages so it shows up in the conversation thread
    // if a customer record exists for this phone.
    const customer = await db
      .prepare(
        `SELECT id FROM customers
           WHERE company_id = ? AND phone IS NOT NULL AND TRIM(phone) != ''`
      )
      .all<{ id: number; phone?: string }>(companyId);
    let customerId: number | null = null;
    if (lead.customer_id) {
      customerId = lead.customer_id;
    } else {
      const match = customer.find(
        (c) =>
          normalizeUSPhone((c as { phone?: string }).phone || "") ===
          normalizeUSPhone(lead.phone || "")
      );
      if (match) customerId = match.id;
    }
    if (customerId) {
      await db
        .prepare(
          `INSERT INTO messages
             (company_id, customer_id, body, direction, status, provider_sid, to_phone, from_phone)
           VALUES (?, ?, ?, 'outbound', ?, ?, ?, NULL)`
        )
        .run(
          companyId,
          customerId,
          body,
          result.status,
          result.sid,
          to
        );
    }
    await db
      .prepare(
        `UPDATE lead_workflow_runs
           SET step_index = step_index + 1,
               last_step_at = datetime('now')
         WHERE id = ?`
      )
      .run(run.id);
    return { advanced: true, immediate: true };
  }

  if (step.type === "update_stage") {
    const tsCol = STAGE_TIMESTAMP[step.stage];
    if (tsCol) {
      await db
        .prepare(
          `UPDATE leads
             SET stage = ?,
                 ${tsCol} = COALESCE(${tsCol}, datetime('now')),
                 updated_at = datetime('now')
           WHERE id = ? AND company_id = ?`
        )
        .run(step.stage, lead.id, companyId);
    } else {
      await db
        .prepare(
          `UPDATE leads SET stage = ?, updated_at = datetime('now')
             WHERE id = ? AND company_id = ?`
        )
        .run(step.stage, lead.id, companyId);
    }
    await db
      .prepare(
        `UPDATE lead_workflow_runs
           SET step_index = step_index + 1,
               last_step_at = datetime('now')
         WHERE id = ?`
      )
      .run(run.id);
    return { advanced: true, immediate: true };
  }

  if (step.type === "create_task") {
    const title = applyVars(step.title, vars);
    const dueIn = step.due_in_minutes || 0;
    await db
      .prepare(
        `INSERT INTO lead_tasks
           (company_id, lead_id, title, due_at, source)
         VALUES (?, ?, ?, datetime('now', ?), 'workflow')`
      )
      .run(companyId, lead.id, title, `+${dueIn} minutes`);
    await db
      .prepare(
        `UPDATE lead_workflow_runs
           SET step_index = step_index + 1,
               last_step_at = datetime('now')
         WHERE id = ?`
      )
      .run(run.id);
    return { advanced: true, immediate: true };
  }

  if (step.type === "notify_admin") {
    const db2 = await getDb();
    const company = await db2
      .prepare("SELECT phone FROM company WHERE id = ?")
      .get<{ phone: string | null }>(companyId);
    const adminPhone = company?.phone;
    if (adminPhone) {
      const to = normalizeUSPhone(adminPhone) || adminPhone;
      const body = applyVars(step.message, vars);
      await sendCompanySms({ companyId, to, body });
    }
    await db
      .prepare(
        `UPDATE lead_workflow_runs
           SET step_index = step_index + 1,
               last_step_at = datetime('now')
         WHERE id = ?`
      )
      .run(run.id);
    return { advanced: true, immediate: true };
  }

  return { advanced: true, immediate: true };
}

// Cron-driven processor. Walks every pending run, executes whatever steps
// are ready, and marks runs completed when they reach the end of their steps.
export async function runPendingWorkflowSteps(): Promise<{
  processed: number;
  steps_executed: number;
  completed: number;
  failed: number;
}> {
  const db = await getDb();
  const runs = (await db
    .prepare(
      `SELECT * FROM lead_workflow_runs WHERE status = 'pending'
         ORDER BY id ASC LIMIT 500`
    )
    .all()) as LeadWorkflowRun[];

  let stepsExecuted = 0;
  let completed = 0;
  let failed = 0;

  for (const run of runs) {
    const wf = await db
      .prepare("SELECT * FROM lead_workflows WHERE id = ?")
      .get<LeadWorkflow>(run.workflow_id);
    if (!wf || !wf.enabled) continue;
    const lead = await db
      .prepare("SELECT * FROM leads WHERE id = ?")
      .get<Lead>(run.lead_id);
    if (!lead) {
      await db
        .prepare(
          `UPDATE lead_workflow_runs SET status = 'failed', error = ?
             WHERE id = ?`
        )
        .run("Lead deleted", run.id);
      failed += 1;
      continue;
    }
    const steps = parseSteps(wf.steps);
    let current = { ...run };
    // Walk as many ready steps as possible in this tick.
    for (let safety = 0; safety < 50; safety += 1) {
      if (current.step_index >= steps.length) {
        await db
          .prepare(
            `UPDATE lead_workflow_runs SET status = 'completed',
                 last_step_at = datetime('now') WHERE id = ?`
          )
          .run(current.id);
        completed += 1;
        break;
      }
      const step = steps[current.step_index];
      const result = await executeStep(current, step, lead, wf.company_id);
      if (result.error && !result.advanced) {
        failed += 1;
        break;
      }
      if (result.advanced) stepsExecuted += 1;
      if (!result.immediate) break;
      // Refresh run row for next iteration.
      const refreshed = await db
        .prepare("SELECT * FROM lead_workflow_runs WHERE id = ?")
        .get<LeadWorkflowRun>(current.id);
      if (!refreshed) break;
      current = refreshed;
    }
  }

  return {
    processed: runs.length,
    steps_executed: stepsExecuted,
    completed,
    failed,
  };
}
