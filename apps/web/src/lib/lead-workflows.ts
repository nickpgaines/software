import {
  getDb,
  type Lead,
  type LeadWorkflow,
  type LeadWorkflowRun,
} from "@/lib/db";
import { sendCompanySms, normalizeUSPhone } from "@/lib/sms";
import {
  parseGraph,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowTrigger,
} from "@/lib/lead-workflows-types";

export {
  WORKFLOW_TRIGGERS,
  WORKFLOW_TEMPLATES,
  STEP_TYPES,
  defaultNode,
  parseGraph,
  parseSteps,
  serializeGraph,
  nodeEdges,
  newNodeId,
} from "@/lib/lead-workflows-types";
export type {
  WorkflowTrigger,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowGraph,
  WorkflowTemplate,
  LeadStageSlug,
  PathCondition,
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
  no_response: null,
};

// Enqueue one workflow_run per branch start of every enabled workflow on
// this company that matches the given trigger, then drain immediately so
// the first action fires on the originating request rather than waiting
// for the daily cron. Safe to call from API routes — failures here must
// never break the originating action.
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
      const graph = parseGraph(wf.steps);
      if (graph.start_ids.length === 0) continue;
      // Don't double-enroll while an active run exists for this workflow + lead.
      const existing = await db
        .prepare(
          `SELECT id FROM lead_workflow_runs
             WHERE workflow_id = ? AND lead_id = ? AND status = 'pending'
             LIMIT 1`
        )
        .get<{ id: number }>(wf.id, leadId);
      if (existing) continue;
      for (const startId of graph.start_ids) {
        if (!graph.nodes[startId]) continue;
        await db
          .prepare(
            `INSERT INTO lead_workflow_runs
               (workflow_id, lead_id, status, step_index, current_node_id, last_step_at)
             VALUES (?, ?, 'pending', 0, ?, datetime('now'))`
          )
          .run(wf.id, leadId, startId);
        enrolled = true;
      }
    }
    if (enrolled) {
      await runPendingWorkflowSteps().catch((e) => {
        console.error("[lead-workflows] inline drain failed", e);
      });
    }
  } catch (err) {
    console.error("[lead-workflows] fireTrigger failed", err);
  }
}

// Advance any pending wait_for_reply runs for this lead onto their
// on_reply edge, then drain. Called from the inbound SMS handler when a
// lead replies.
export async function advanceWaitingRunsOnReply(args: {
  companyId: number;
  leadId: number;
}): Promise<void> {
  try {
    const { companyId, leadId } = args;
    const db = await getDb();
    const runs = (await db
      .prepare(
        `SELECT r.* FROM lead_workflow_runs r
           JOIN lead_workflows w ON w.id = r.workflow_id
          WHERE r.lead_id = ? AND r.status = 'pending'
            AND w.company_id = ?`
      )
      .all(leadId, companyId)) as LeadWorkflowRun[];
    let advanced = false;
    for (const run of runs) {
      const wf = await db
        .prepare("SELECT * FROM lead_workflows WHERE id = ?")
        .get<LeadWorkflow>(run.workflow_id);
      if (!wf) continue;
      const graph = parseGraph(wf.steps);
      const node = run.current_node_id
        ? graph.nodes[run.current_node_id]
        : undefined;
      if (!node || node.type !== "wait_for_reply") continue;
      const next = node.on_reply ?? null;
      await db
        .prepare(
          `UPDATE lead_workflow_runs
             SET current_node_id = ?, last_step_at = datetime('now')
           WHERE id = ?`
        )
        .run(next, run.id);
      advanced = true;
    }
    if (advanced) {
      await runPendingWorkflowSteps().catch((e) => {
        console.error("[lead-workflows] reply drain failed", e);
      });
    }
  } catch (err) {
    console.error("[lead-workflows] advanceWaitingRunsOnReply failed", err);
  }
}

type StepResult = {
  // Where to go next. `null` means terminate the branch (completed).
  next_node_id: string | null;
  // `true` if the cron should immediately try the next node in the same
  // tick; `false` means we're parked (delay timer, waiting on reply).
  immediate: boolean;
  // Hard error: mark run failed and stop.
  error?: string;
};

async function executeNode(
  run: LeadWorkflowRun,
  node: WorkflowNode,
  lead: Lead,
  graph: WorkflowGraph,
  companyId: number
): Promise<StepResult> {
  const db = await getDb();
  const vars = await leadVars(companyId, lead);

  if (node.type === "delay") {
    const lastIso = run.last_step_at || run.created_at;
    const lastMs = new Date(lastIso + "Z").getTime();
    if (Number.isNaN(lastMs)) {
      return { next_node_id: node.next ?? null, immediate: true };
    }
    const elapsedMin = (Date.now() - lastMs) / 60000;
    if (elapsedMin < node.minutes) {
      return { next_node_id: node.id, immediate: false };
    }
    return { next_node_id: node.next ?? null, immediate: true };
  }

  if (node.type === "wait_for_reply") {
    const lastIso = run.last_step_at || run.created_at;
    const lastMs = new Date(lastIso + "Z").getTime();
    if (Number.isNaN(lastMs)) {
      return { next_node_id: node.on_timeout ?? null, immediate: true };
    }
    const elapsedMin = (Date.now() - lastMs) / 60000;
    if (elapsedMin < node.timeout_minutes) {
      // Park here; advanceWaitingRunsOnReply will move us to on_reply when
      // the lead replies, and the cron will move us to on_timeout once the
      // timer elapses.
      return { next_node_id: node.id, immediate: false };
    }
    return { next_node_id: node.on_timeout ?? null, immediate: true };
  }

  if (node.type === "send_sms") {
    if (!lead.phone) {
      return {
        next_node_id: node.next ?? null,
        immediate: true,
        error: "Lead has no phone",
      };
    }
    const to = normalizeUSPhone(lead.phone) || lead.phone;
    const body = applyVars(node.message, vars);
    const result = await sendCompanySms({ companyId, to, body });
    if (!result.ok) {
      return {
        next_node_id: node.id,
        immediate: false,
        error: result.error,
      };
    }
    // Mirror outbound into messages so it shows up in the conversation thread.
    let customerId: number | null = lead.customer_id ?? null;
    if (!customerId) {
      const customers = (await db
        .prepare(
          `SELECT id, phone FROM customers
             WHERE company_id = ? AND phone IS NOT NULL AND TRIM(phone) != ''`
        )
        .all(companyId)) as { id: number; phone: string }[];
      const fromNorm = normalizeUSPhone(lead.phone || "");
      const match = customers.find(
        (c) => normalizeUSPhone(c.phone) === fromNorm
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
        .run(companyId, customerId, body, result.status, result.sid, to);
    }
    return { next_node_id: node.next ?? null, immediate: true };
  }

  if (node.type === "update_stage") {
    const tsCol = STAGE_TIMESTAMP[node.stage];
    if (tsCol) {
      await db
        .prepare(
          `UPDATE leads
             SET stage = ?,
                 ${tsCol} = COALESCE(${tsCol}, datetime('now')),
                 updated_at = datetime('now')
           WHERE id = ? AND company_id = ?`
        )
        .run(node.stage, lead.id, companyId);
    } else {
      await db
        .prepare(
          `UPDATE leads SET stage = ?, updated_at = datetime('now')
             WHERE id = ? AND company_id = ?`
        )
        .run(node.stage, lead.id, companyId);
    }
    return { next_node_id: node.next ?? null, immediate: true };
  }

  if (node.type === "create_task") {
    const title = applyVars(node.title, vars);
    const dueIn = node.due_in_minutes || 0;
    await db
      .prepare(
        `INSERT INTO lead_tasks
           (company_id, lead_id, title, due_at, source)
         VALUES (?, ?, ?, datetime('now', ?), 'workflow')`
      )
      .run(companyId, lead.id, title, `+${dueIn} minutes`);
    return { next_node_id: node.next ?? null, immediate: true };
  }

  if (node.type === "notify_admin") {
    const company = await db
      .prepare("SELECT phone FROM company WHERE id = ?")
      .get<{ phone: string | null }>(companyId);
    const adminPhone = company?.phone;
    if (adminPhone) {
      const to = normalizeUSPhone(adminPhone) || adminPhone;
      const body = applyVars(node.message, vars);
      await sendCompanySms({ companyId, to, body });
    }
    return { next_node_id: node.next ?? null, immediate: true };
  }

  if (node.type === "paths") {
    const cond = node.condition;
    let matched = false;
    if (cond.kind === "lead_stage_is") {
      matched = lead.stage === cond.stage;
    }
    return {
      next_node_id: (matched ? node.yes_next : node.no_next) ?? null,
      immediate: true,
    };
  }

  // Unknown node type — bail.
  return { next_node_id: null, immediate: true };
}

// Cron-driven processor. Walks every pending run, executes as many ready
// nodes as it can in this tick, and marks runs completed/failed when they
// reach the end of their branch or hit a hard error. Caps at 50 steps per
// run per tick so a pathological cycle can't lock the worker.
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
    const graph = parseGraph(wf.steps);
    let current = { ...run };
    for (let safety = 0; safety < 50; safety += 1) {
      const nodeId = current.current_node_id;
      if (!nodeId) {
        await db
          .prepare(
            `UPDATE lead_workflow_runs SET status = 'completed',
                 last_step_at = datetime('now') WHERE id = ?`
          )
          .run(current.id);
        completed += 1;
        break;
      }
      const node = graph.nodes[nodeId];
      if (!node) {
        await db
          .prepare(
            `UPDATE lead_workflow_runs SET status = 'failed', error = ?
               WHERE id = ?`
          )
          .run(`Missing node ${nodeId}`, current.id);
        failed += 1;
        break;
      }
      const result = await executeNode(current, node, lead, graph, wf.company_id);
      if (result.error && result.next_node_id === node.id) {
        // Hard failure that left us parked on the same node.
        await db
          .prepare(
            `UPDATE lead_workflow_runs
               SET status = 'failed', error = ?, last_step_at = datetime('now')
             WHERE id = ?`
          )
          .run(result.error, current.id);
        failed += 1;
        break;
      }
      stepsExecuted += 1;
      await db
        .prepare(
          `UPDATE lead_workflow_runs
             SET current_node_id = ?, step_index = step_index + 1,
                 last_step_at = datetime('now')
           WHERE id = ?`
        )
        .run(result.next_node_id, current.id);
      if (!result.immediate) break;
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
