// Client-safe types & constants for lead workflows.
//
// Workflows are stored as a directed graph of nodes. Each node has a stable
// id and one or more outgoing edges that name the next node id. This
// supports parallel branches off the trigger, if/else paths, and
// wait-for-reply nodes that fork on (replied | timed out). Older code wrote
// a linear array — `parseSteps` converts that on the fly.

export type WorkflowTrigger =
  | "lead_created"
  | "lead_stage_changed"
  | "lead_replied"
  | "missed_call"
  | "estimate_sent"
  | "estimate_accepted";

export const WORKFLOW_TRIGGERS: { value: WorkflowTrigger; label: string }[] = [
  { value: "lead_created", label: "A new lead is created" },
  { value: "lead_stage_changed", label: "Lead is moved to a stage" },
  { value: "lead_replied", label: "Lead replies" },
  { value: "missed_call", label: "Missed call" },
  { value: "estimate_sent", label: "Estimate is sent" },
  { value: "estimate_accepted", label: "Estimate is accepted" },
];

export type LeadStageSlug =
  | "new"
  | "contacted"
  | "responded"
  | "estimate_sent"
  | "no_response";

// Conditions usable on a Paths (If/Else) node. Only stage equality is
// surfaced in the Flyra templates today; we keep the shape extensible.
export type PathCondition = {
  kind: "lead_stage_is";
  stage: LeadStageSlug;
};

// One node in the workflow graph. Every node has an id (a short string,
// stable across saves) and edges to the next node(s) by id. Edges that
// point nowhere terminate that branch.
export type WorkflowNode =
  | { id: string; type: "delay"; minutes: number; next?: string | null }
  | { id: string; type: "send_sms"; message: string; next?: string | null }
  | {
      id: string;
      type: "update_stage";
      stage: LeadStageSlug;
      next?: string | null;
    }
  | {
      id: string;
      type: "create_task";
      title: string;
      due_in_minutes?: number;
      next?: string | null;
    }
  | {
      id: string;
      type: "notify_admin";
      message: string;
      next?: string | null;
    }
  | {
      id: string;
      type: "wait_for_reply";
      timeout_minutes: number;
      on_reply?: string | null;
      on_timeout?: string | null;
    }
  | {
      id: string;
      type: "paths";
      condition: PathCondition;
      yes_next?: string | null;
      no_next?: string | null;
    };

export type WorkflowNodeType = WorkflowNode["type"];

// The full graph: a set of branch starts (each becomes its own run) and a
// node map keyed by id.
export type WorkflowGraph = {
  start_ids: string[];
  nodes: Record<string, WorkflowNode>;
};

export const STEP_TYPES: {
  value: WorkflowNodeType;
  label: string;
  description: string;
}[] = [
  {
    value: "send_sms",
    label: "Send text message",
    description: "Send an SMS to the lead",
  },
  {
    value: "delay",
    label: "Delay for",
    description: "Pause before the next step",
  },
  {
    value: "wait_for_reply",
    label: "Wait for reply",
    description: "Branch on reply or timeout",
  },
  {
    value: "paths",
    label: "Paths (If/Else)",
    description: "Split into Yes / No branches",
  },
  {
    value: "update_stage",
    label: "Update lead stage",
    description: "Move lead to another pipeline stage",
  },
  {
    value: "create_task",
    label: "Create task",
    description: "Create a task for a teammate",
  },
  {
    value: "notify_admin",
    label: "Notify admin",
    description: "Send SMS notification to the org phone",
  },
];

let _nextNodeIdCounter = 0;
export function newNodeId(prefix = "n"): string {
  _nextNodeIdCounter += 1;
  // Suffix with a random chunk so two clients editing concurrently don't
  // collide on the same monotonic id.
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}_${_nextNodeIdCounter}`;
}

export function defaultNode(type: WorkflowNodeType): WorkflowNode {
  const id = newNodeId();
  switch (type) {
    case "send_sms":
      return { id, type: "send_sms", message: "Hi {{first_name}}, " };
    case "delay":
      return { id, type: "delay", minutes: 60 };
    case "update_stage":
      return { id, type: "update_stage", stage: "contacted" };
    case "create_task":
      return { id, type: "create_task", title: "Follow up with {{first_name}}" };
    case "notify_admin":
      return {
        id,
        type: "notify_admin",
        message: "New lead {{first_name}} {{last_name}} needs attention.",
      };
    case "wait_for_reply":
      return { id, type: "wait_for_reply", timeout_minutes: 60 * 24 };
    case "paths":
      return {
        id,
        type: "paths",
        condition: { kind: "lead_stage_is", stage: "contacted" },
      };
  }
}

// A small builder so the (long) Flyra templates stay readable below.
class GraphBuilder {
  nodes: Record<string, WorkflowNode> = {};
  private idCounter = 0;
  newId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }
  add(node: WorkflowNode): string {
    this.nodes[node.id] = node;
    return node.id;
  }
  set(id: string, patch: Partial<WorkflowNode>): void {
    this.nodes[id] = { ...this.nodes[id], ...patch } as WorkflowNode;
  }
  graph(...startIds: string[]): WorkflowGraph {
    return { start_ids: startIds, nodes: this.nodes };
  }
}

// -- Template 1: Missed Call Text-Back --------------------------------
function buildMissedCallTextback(): WorkflowGraph {
  const b = new GraphBuilder();
  const notify = b.add({
    id: b.newId("notify"),
    type: "notify_admin",
    message: "Missed call from {{first_name}} {{last_name}} ({{phone}}).",
  });
  const stage = b.add({
    id: b.newId("stage"),
    type: "update_stage",
    stage: "contacted",
  });
  const sms = b.add({
    id: b.newId("sms"),
    type: "send_sms",
    message:
      "Hey this is {{company_name}}, sorry I missed your call. I'm with a customer right now. How can I help?",
    next: stage,
  });
  const wait = b.add({
    id: b.newId("delay"),
    type: "delay",
    minutes: 1,
    next: sms,
  });
  // notify branch terminates; main branch is wait → sms → stage
  return b.graph(notify, wait);
}

// -- Template 2: New Lead Follow-up (Flyra long sequence) -------------
function buildNewLeadFollowup(): WorkflowGraph {
  const b = new GraphBuilder();
  // Shared response chain — every Wait for reply's on_reply edge points
  // here. One copy, multiple incoming edges, exactly like the Flyra graph.
  const respStage = b.add({
    id: "resp_stage",
    type: "update_stage",
    stage: "responded",
  });
  const respNotify = b.add({
    id: "resp_notify",
    type: "notify_admin",
    message: "Lead {{first_name}} {{last_name}} just replied — see Inbox.",
    next: respStage,
  });
  const respSms = b.add({
    id: "resp_sms",
    type: "send_sms",
    message: "Got it. Giving you a ring.",
    next: respNotify,
  });

  // Top-level parallel branch: notify admin
  const startNotify = b.add({
    id: "start_notify",
    type: "notify_admin",
    message: "New lead {{first_name}} {{last_name}} ({{phone}}).",
  });
  // Top-level parallel branch: mark contacted
  const startStage = b.add({
    id: "start_stage",
    type: "update_stage",
    stage: "contacted",
  });

  // Final terminal: mark lead no_response after all check-ins time out.
  const finalStage = b.add({
    id: "final_no_response",
    type: "update_stage",
    stage: "no_response",
  });

  // Build one Wait→Paths→Send unit. Returns the wait id (chain entry) and
  // the paths id (so the caller can wire the "no" edge to the next unit).
  function buildCheckin(
    timeoutMin: number,
    yesMessage: string
  ): { firstId: string; pathsId: string } {
    const yesSms = b.add({
      id: b.newId("yes_sms"),
      type: "send_sms",
      message: yesMessage,
    });
    const paths = b.add({
      id: b.newId("paths"),
      type: "paths",
      condition: { kind: "lead_stage_is", stage: "contacted" },
      yes_next: yesSms,
    });
    const wait = b.add({
      id: b.newId("wait"),
      type: "wait_for_reply",
      timeout_minutes: timeoutMin,
      on_reply: respSms,
      on_timeout: paths,
    });
    return { firstId: wait, pathsId: paths };
  }

  const checkins = [
    { timeout: 3 * 60, message: "{{first_name}}, what's a good time to chat?" },
    { timeout: 7 * 24 * 60, message: "Hey {{first_name}}, checking back in." },
    { timeout: 7 * 24 * 60, message: "Hey, checking in on this." },
    { timeout: 7 * 24 * 60, message: "Hey {{first_name}}, circling back." },
    { timeout: 7 * 24 * 60, message: "Hey {{first_name}}, checking back in." },
    { timeout: 14 * 24 * 60, message: "Hey, checking in on this." },
    { timeout: 30 * 24 * 60, message: "Hey {{first_name}}, circling back." },
    { timeout: 90 * 24 * 60, message: "Hey {{first_name}}, checking back in." },
  ];

  const built = checkins.map((c) => buildCheckin(c.timeout, c.message));
  for (let i = 0; i < built.length; i += 1) {
    const next = i + 1 < built.length ? built[i + 1].firstId : finalStage;
    b.set(built[i].pathsId, { no_next: next });
  }

  // Main branch entry: opening delay → opening SMS → first wait.
  const openingSms = b.add({
    id: "open_sms",
    type: "send_sms",
    message:
      "Hey {{first_name}}, this is {{company_name}}. Just confirming we got your inquiry — want me to set up a quick call?",
    next: built[0].firstId,
  });
  const openingDelay = b.add({
    id: "open_delay",
    type: "delay",
    minutes: 1,
    next: openingSms,
  });

  return b.graph(startNotify, startStage, openingDelay);
}

// -- Template 3: Quote Request Confirmation ---------------------------
function buildQuoteRequest(): WorkflowGraph {
  const b = new GraphBuilder();
  const stage = b.add({
    id: b.newId("stage"),
    type: "update_stage",
    stage: "contacted",
  });
  const sms = b.add({
    id: b.newId("sms"),
    type: "send_sms",
    message:
      "Hi {{first_name}}, thanks for requesting a quote from {{company_name}}. We just received your form and will send your estimate as soon as possible. If you want to add any details now, reply here. You can also call us anytime.",
    next: stage,
  });
  return b.graph(sms);
}

export type WorkflowTemplate = {
  key: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  graph: WorkflowGraph;
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "missed_call_textback",
    name: "Missed Call Text-Back",
    description:
      "Instantly text the lead when a call comes in but isn't answered, and notify the admin in parallel.",
    trigger: "missed_call",
    graph: buildMissedCallTextback(),
  },
  {
    key: "new_lead_followup",
    name: "New Lead Follow-up",
    description:
      "Notify the admin, mark the lead contacted, then run an 8-touch reply-aware nurture sequence over ~5 months.",
    trigger: "lead_created",
    graph: buildNewLeadFollowup(),
  },
  {
    key: "quote_request",
    name: "Quote Request Confirmation",
    description:
      "Confirm a quote request via SMS and advance the lead to Contacted.",
    trigger: "lead_created",
    graph: buildQuoteRequest(),
  },
];

// Parse either the new graph JSON or the legacy linear array. Linear
// arrays become a single-branch chain in the graph.
export function parseGraph(raw: string): WorkflowGraph {
  if (!raw) return { start_ids: [], nodes: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { start_ids: [], nodes: {} };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "nodes" in parsed &&
    "start_ids" in parsed
  ) {
    const g = parsed as WorkflowGraph;
    return {
      start_ids: Array.isArray(g.start_ids) ? g.start_ids : [],
      nodes: g.nodes && typeof g.nodes === "object" ? g.nodes : {},
    };
  }
  // Legacy linear array → chain.
  if (Array.isArray(parsed)) {
    const nodes: Record<string, WorkflowNode> = {};
    const ids: string[] = parsed.map((_, i) => `legacy_${i}`);
    parsed.forEach((step, i) => {
      const id = ids[i];
      const next = ids[i + 1] ?? null;
      const s = step as Record<string, unknown>;
      const t = s.type as WorkflowNodeType;
      if (t === "send_sms") {
        nodes[id] = {
          id,
          type: "send_sms",
          message: String(s.message ?? ""),
          next,
        };
      } else if (t === "delay") {
        nodes[id] = {
          id,
          type: "delay",
          minutes: Number(s.minutes ?? 60),
          next,
        };
      } else if (t === "update_stage") {
        nodes[id] = {
          id,
          type: "update_stage",
          stage: (s.stage as LeadStageSlug) ?? "contacted",
          next,
        };
      } else if (t === "create_task") {
        nodes[id] = {
          id,
          type: "create_task",
          title: String(s.title ?? "Follow up"),
          due_in_minutes:
            typeof s.due_in_minutes === "number" ? s.due_in_minutes : 0,
          next,
        };
      } else if (t === "notify_admin") {
        nodes[id] = {
          id,
          type: "notify_admin",
          message: String(s.message ?? ""),
          next,
        };
      }
    });
    return { start_ids: ids.length ? [ids[0]] : [], nodes };
  }
  return { start_ids: [], nodes: {} };
}

export function serializeGraph(g: WorkflowGraph): string {
  return JSON.stringify(g);
}

// Backwards-compat helper: existing callers expect `parseSteps` to return
// an array. New code should call `parseGraph` instead. We keep this as a
// thin shim that walks the first branch only.
export function parseSteps(raw: string): WorkflowNode[] {
  const g = parseGraph(raw);
  const out: WorkflowNode[] = [];
  const seen = new Set<string>();
  let cur: string | null | undefined = g.start_ids[0];
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node: WorkflowNode | undefined = g.nodes[cur];
    if (!node) break;
    out.push(node);
    cur = "next" in node ? node.next ?? null : null;
  }
  return out;
}

// Outgoing-edge keys per node type, for the layout and executor walkers.
export function nodeEdges(node: WorkflowNode): { label: string; next: string | null | undefined }[] {
  if (node.type === "wait_for_reply") {
    return [
      { label: "On Reply", next: node.on_reply },
      { label: "On Timeout", next: node.on_timeout },
    ];
  }
  if (node.type === "paths") {
    return [
      { label: "Yes", next: node.yes_next },
      { label: "No", next: node.no_next },
    ];
  }
  if ("next" in node) {
    return [{ label: "", next: node.next }];
  }
  return [];
}
