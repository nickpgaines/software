"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  ArrowRightLeft,
  CheckSquare,
  Bell,
  Plus,
  Trash2,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Zap,
  ChevronDown,
  Hourglass,
  GitBranch,
} from "lucide-react";
import type { LeadWorkflow, LeadWorkflowRun } from "@/lib/db";
import {
  STEP_TYPES,
  WORKFLOW_TRIGGERS,
  defaultNode,
  parseGraph,
  serializeGraph,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowTrigger,
  type LeadStageSlug,
} from "@/lib/lead-workflows-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const STAGES: { value: LeadStageSlug; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "estimate_sent", label: "Estimate sent" },
  { value: "no_response", label: "No response" },
];

const STEP_ICONS: Record<WorkflowNodeType, typeof MessageSquare> = {
  send_sms: MessageSquare,
  delay: Clock,
  update_stage: ArrowRightLeft,
  create_task: CheckSquare,
  notify_admin: Bell,
  wait_for_reply: Hourglass,
  paths: GitBranch,
};

const NODE_W = 240;
const NODE_H = 64;
const ROW_GAP = 56;
const COL_GAP = 24;
const CANVAS_PAD = 40;

// Synthetic END nodes are inserted at every dangling edge so the canvas
// always renders a terminator pill. The string is just a sentinel id; the
// layout treats it as a leaf.
const END_ID = "__end__";

type Selection =
  | { kind: "trigger" }
  | { kind: "step"; nodeId: string }
  | null;

type LaidNode = {
  id: string;
  x: number;
  y: number;
  isEnd?: boolean;
};

type LaidEdge = {
  fromId: string;
  toId: string;
  label: string;
};

// Tree layout. We treat the trigger as a synthetic super-root whose
// children are the graph's start_ids. Subtree widths bubble up so each
// parent sits centered above its children. Shared nodes appear once at
// the depth of their *first* visit (no DAG re-layout); subsequent edges
// just draw connectors to the same position.
function layoutGraph(
  graph: WorkflowGraph
): {
  nodes: Map<string, LaidNode>;
  edges: LaidEdge[];
  endNodes: Map<string, LaidNode>;
  width: number;
  height: number;
} {
  const positions = new Map<string, LaidNode>();
  const endNodes = new Map<string, LaidNode>();
  const edges: LaidEdge[] = [];
  const TRIGGER_ID = "__trigger__";

  // First pass: assign each node a depth (row) by BFS from the trigger.
  const depth = new Map<string, number>();
  depth.set(TRIGGER_ID, 0);
  const queue: { id: string; from: string }[] = graph.start_ids.map((id) => ({
    id,
    from: TRIGGER_ID,
  }));
  while (queue.length) {
    const { id, from } = queue.shift()!;
    if (!graph.nodes[id]) continue;
    const fromDepth = depth.get(from) ?? 0;
    if (!depth.has(id)) {
      depth.set(id, fromDepth + 1);
      const n = graph.nodes[id];
      const nexts = childrenOf(n);
      for (const c of nexts) {
        if (c.next && graph.nodes[c.next]) {
          queue.push({ id: c.next, from: id });
        }
      }
    }
  }

  // Second pass: assign subtree widths by post-order, then x positions by
  // pre-order. We walk the tree formed by *first* visits — any edge that
  // points back to an already-visited node is treated as a cross-edge for
  // edge-drawing only.
  const visitedForLayout = new Set<string>();
  type Subtree = { id: string; cols: number; children: Subtree[] };

  function buildSubtree(id: string): Subtree {
    if (visitedForLayout.has(id)) return { id, cols: 0, children: [] };
    visitedForLayout.add(id);
    const node = graph.nodes[id];
    if (!node) return { id, cols: 1, children: [] };
    const childInfos = childrenOf(node);
    const realChildren: Subtree[] = [];
    let danglingCols = 0;
    for (const c of childInfos) {
      if (c.next && graph.nodes[c.next] && !visitedForLayout.has(c.next)) {
        realChildren.push(buildSubtree(c.next));
      } else if (!c.next) {
        // Truly dangling edge: needs a column to terminate with END.
        danglingCols += 1;
      }
      // Edges to already-visited (shared) nodes contribute no column; the
      // edge is drawn as a connector to the existing layout slot.
    }
    const childCols = realChildren.reduce((acc, c) => acc + c.cols, 0);
    const cols = Math.max(1, childCols + danglingCols);
    return { id, cols, children: realChildren };
  }

  // Build the super-tree by buildingSubtree on each start_id and adding a
  // synthetic root above them.
  const startSubtrees: Subtree[] = [];
  for (const sid of graph.start_ids) {
    if (graph.nodes[sid]) startSubtrees.push(buildSubtree(sid));
  }
  const rootCols = Math.max(
    1,
    startSubtrees.reduce((acc, s) => acc + s.cols, 0)
  );
  const totalCols = rootCols;
  const totalRows = Math.max(...Array.from(depth.values()), 1) + 1;

  // Lay out by descending the subtree and assigning x = midpoint of allocated columns.
  function layoutSubtree(s: Subtree, leftCol: number, row: number): void {
    const x = CANVAS_PAD + (leftCol + s.cols / 2) * (NODE_W + COL_GAP);
    const y = CANVAS_PAD + row * (NODE_H + ROW_GAP);
    if (!positions.has(s.id)) {
      positions.set(s.id, { id: s.id, x, y });
    }
    let cursor = leftCol;
    const node = graph.nodes[s.id];
    if (!node) return;
    const childInfos = childrenOf(node);
    // Walk children in order. For unrecognized / dangling / shared edges,
    // allocate one column and emit an END placeholder if dangling.
    for (const c of childInfos) {
      if (c.next && graph.nodes[c.next]) {
        const childSubtree = s.children.find((cs) => cs.id === c.next);
        if (childSubtree) {
          layoutSubtree(childSubtree, cursor, row + 1);
          cursor += childSubtree.cols;
          edges.push({ fromId: s.id, toId: c.next, label: c.label });
        } else {
          // Shared node — already laid out elsewhere; just draw an edge.
          edges.push({ fromId: s.id, toId: c.next, label: c.label });
          // Don't advance cursor — shared edges share columns visually.
        }
      } else {
        // Dangling: place an END node.
        const endId = `${END_ID}_${s.id}_${c.label}`;
        const ex = CANVAS_PAD + (cursor + 0.5) * (NODE_W + COL_GAP);
        const ey = CANVAS_PAD + (row + 1) * (NODE_H + ROW_GAP);
        endNodes.set(endId, { id: endId, x: ex, y: ey, isEnd: true });
        edges.push({ fromId: s.id, toId: endId, label: c.label });
        cursor += 1;
      }
    }
  }

  let startCursor = 0;
  for (const s of startSubtrees) {
    layoutSubtree(s, startCursor, 1);
    startCursor += s.cols;
  }

  // Trigger sits row 0, centered over the whole canvas.
  const triggerX = CANVAS_PAD + (totalCols / 2) * (NODE_W + COL_GAP);
  positions.set(TRIGGER_ID, { id: TRIGGER_ID, x: triggerX, y: CANVAS_PAD });

  // Trigger → start_ids edges.
  for (const sid of graph.start_ids) {
    if (graph.nodes[sid]) {
      edges.push({ fromId: TRIGGER_ID, toId: sid, label: "" });
    }
  }

  const width = CANVAS_PAD * 2 + totalCols * (NODE_W + COL_GAP);
  const height = CANVAS_PAD * 2 + totalRows * (NODE_H + ROW_GAP) + 40;
  return { nodes: positions, edges, endNodes, width, height };
}

function childrenOf(
  node: WorkflowNode
): { label: string; next: string | null | undefined }[] {
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
  if ("next" in node) return [{ label: "", next: node.next }];
  return [];
}

export default function LeadsWorkflowEditor({
  initialWorkflow,
  initialRuns,
}: {
  initialWorkflow: LeadWorkflow;
  initialRuns: LeadWorkflowRun[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialWorkflow.name);
  const [trigger, setTrigger] = useState<WorkflowTrigger>(
    (initialWorkflow.trigger as WorkflowTrigger) || "lead_created"
  );
  const [enabled, setEnabled] = useState(!!initialWorkflow.enabled);
  const [graph, setGraph] = useState<WorkflowGraph>(() =>
    parseGraph(initialWorkflow.steps)
  );
  const [selection, setSelection] = useState<Selection>({ kind: "trigger" });
  const [zoom, setZoom] = useState(0.8);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const laid = useMemo(() => layoutGraph(graph), [graph]);

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    setGraph((g) => ({
      ...g,
      nodes: {
        ...g.nodes,
        [id]: { ...g.nodes[id], ...patch } as WorkflowNode,
      },
    }));
  }

  // Find leaf ids: any node whose outgoing edges are all null/missing.
  // Plus the trigger itself when there are no start_ids.
  function findLeafIdsForAppend(): string[] {
    const leaves: string[] = [];
    if (graph.start_ids.length === 0) return [];
    for (const id of Object.keys(graph.nodes)) {
      const n = graph.nodes[id];
      const kids = childrenOf(n);
      if (kids.every((c) => !c.next)) leaves.push(id);
    }
    return leaves;
  }

  // Append a new node onto the currently-selected node (or the trigger
  // when nothing's selected). Wires the new node into the first dangling
  // edge of the parent.
  function appendNode(type: WorkflowNodeType) {
    const newNode = defaultNode(type);
    setGraph((g) => {
      const nodes = { ...g.nodes, [newNode.id]: newNode };
      // Determine parent.
      if (selection?.kind === "step") {
        const parent = nodes[selection.nodeId];
        if (parent) {
          const updated = wireFirstDangling(parent, newNode.id);
          nodes[parent.id] = updated;
        }
        return { ...g, nodes };
      }
      // Trigger selected (or nothing): append as a new branch off the trigger.
      return { start_ids: [...g.start_ids, newNode.id], nodes };
    });
    setSelection({ kind: "step", nodeId: newNode.id });
  }

  function wireFirstDangling(
    parent: WorkflowNode,
    childId: string
  ): WorkflowNode {
    if (parent.type === "wait_for_reply") {
      if (!parent.on_reply) return { ...parent, on_reply: childId };
      if (!parent.on_timeout) return { ...parent, on_timeout: childId };
      return parent;
    }
    if (parent.type === "paths") {
      if (!parent.yes_next) return { ...parent, yes_next: childId };
      if (!parent.no_next) return { ...parent, no_next: childId };
      return parent;
    }
    if ("next" in parent) {
      if (!parent.next) return { ...parent, next: childId };
      return parent;
    }
    return parent;
  }

  function deleteNode(id: string) {
    setGraph((g) => {
      const target = g.nodes[id];
      if (!target) return g;
      // Find the first child (its "downstream") and rewire parents to it.
      const replacement =
        ("next" in target && target.next) ||
        (target.type === "paths" && (target.yes_next || target.no_next)) ||
        (target.type === "wait_for_reply" &&
          (target.on_timeout || target.on_reply)) ||
        null;
      const nodes = { ...g.nodes };
      delete nodes[id];
      // Rewire every parent edge pointing at `id` → replacement.
      for (const nid of Object.keys(nodes)) {
        const n = nodes[nid];
        if (n.type === "wait_for_reply") {
          let changed = { ...n };
          if (changed.on_reply === id) changed = { ...changed, on_reply: replacement };
          if (changed.on_timeout === id)
            changed = { ...changed, on_timeout: replacement };
          nodes[nid] = changed;
          continue;
        }
        if (n.type === "paths") {
          let changed = { ...n };
          if (changed.yes_next === id) changed = { ...changed, yes_next: replacement };
          if (changed.no_next === id) changed = { ...changed, no_next: replacement };
          nodes[nid] = changed;
          continue;
        }
        if ("next" in n && n.next === id) {
          nodes[nid] = { ...n, next: replacement };
        }
      }
      const startIds = g.start_ids
        .map((sid) => (sid === id ? replacement : sid))
        .filter((sid): sid is string => !!sid);
      return { start_ids: startIds, nodes };
    });
    setSelection({ kind: "trigger" });
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch(`/api/lead-workflows/${initialWorkflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          trigger,
          enabled,
          steps: serializeGraph(graph),
        }),
      });
      if (!res.ok) throw new Error();
      setSaved("Saved");
      router.refresh();
    } catch {
      setSaved("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkflow() {
    if (!confirm("Delete this workflow? Active runs will stop.")) return;
    const res = await fetch(`/api/lead-workflows/${initialWorkflow.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/leads/workflows");
  }

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)));
  const zoomReset = () => setZoom(0.8);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-line px-4 md:px-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/leads/workflows"
            className="text-zinc-400 hover:text-white shrink-0"
            aria-label="Back to workflows"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-md text-base font-extrabold bg-transparent border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white h-auto py-1"
            placeholder="Workflow name"
          />
          <span
            className={
              "text-xs px-3 py-1 rounded-full shrink-0 " +
              (enabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-black text-zinc-400")
            }
          >
            {enabled ? "Active" : "Paused"}
          </span>
          {saved && (
            <span className="text-xs text-zinc-400 font-bold">{saved}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((e) => !e)}
            className={
              "relative w-10 h-6 p-0 rounded-full hover:bg-current " +
              (enabled
                ? "bg-emerald-500 hover:bg-emerald-500"
                : "bg-line-strong hover:bg-line-strong")
            }
          >
            <span
              className={
                "absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform " +
                (enabled ? "translate-x-4" : "")
              }
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={save}
            disabled={saving}
            className="h-auto gap-1.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-bold px-4 py-2 rounded-full"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={deleteWorkflow}
            className="h-auto p-2 rounded-full text-rose-400 hover:text-rose-300 hover:bg-transparent"
            aria-label="Delete workflow"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: step palette */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-line p-3 gap-1 overflow-y-auto">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide px-2 py-1">
            Add a step
          </div>
          {STEP_TYPES.map((t) => {
            const Icon = STEP_ICONS[t.value];
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => appendNode(t.value)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-black group"
              >
                <span className="w-8 h-8 rounded-lg bg-black inline-flex items-center justify-center shrink-0 group-hover:bg-line">
                  <Icon className="w-4 h-4 text-zinc-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white truncate">
                    {t.label}
                  </span>
                  <span className="block text-xs text-zinc-500 truncate">
                    {t.description}
                  </span>
                </span>
                <Plus className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
            );
          })}
        </aside>

        {/* Center: canvas */}
        <div
          className="flex-1 relative overflow-auto bg-canvas"
          onClick={() => setSelection(null)}
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div
            className="relative origin-top-left"
            style={{
              width: laid.width,
              height: laid.height,
              transform: `scale(${zoom})`,
            }}
          >
            <CanvasSvg
              edges={laid.edges}
              positions={laid.nodes}
              endPositions={laid.endNodes}
            />

            {/* Trigger node */}
            <CanvasNode
              x={laid.nodes.get("__trigger__")?.x ?? 0}
              y={laid.nodes.get("__trigger__")?.y ?? 0}
              selected={selection?.kind === "trigger"}
              onClick={(e) => {
                e.stopPropagation();
                setSelection({ kind: "trigger" });
              }}
              accent="blue"
              icon={<Zap className="w-4 h-4 text-blue-300" />}
              title="When this happens"
              subtitle={
                WORKFLOW_TRIGGERS.find((t) => t.value === trigger)?.label ||
                trigger
              }
            />

            {/* Step nodes */}
            {Array.from(laid.nodes.values())
              .filter((n) => n.id !== "__trigger__")
              .map((pos) => {
                const node = graph.nodes[pos.id];
                if (!node) return null;
                const Icon = STEP_ICONS[node.type];
                const meta = STEP_TYPES.find((t) => t.value === node.type);
                return (
                  <CanvasNode
                    key={pos.id}
                    x={pos.x}
                    y={pos.y}
                    selected={
                      selection?.kind === "step" &&
                      selection.nodeId === pos.id
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelection({ kind: "step", nodeId: pos.id });
                    }}
                    icon={<Icon className="w-4 h-4 text-zinc-300" />}
                    title={meta?.label || node.type}
                    subtitle={nodeSummary(node)}
                  />
                );
              })}

            {/* END pills */}
            {Array.from(laid.endNodes.values()).map((p) => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2"
                style={{ left: p.x, top: p.y + NODE_H / 2 - 12 }}
              >
                <div className="text-[10px] font-bold tracking-wider text-zinc-500 bg-black px-3 py-1 rounded-full border border-line">
                  END
                </div>
              </div>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 flex flex-col gap-1 bg-card border border-line rounded-xl p-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomIn();
              }}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-black"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomReset();
              }}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-black"
              aria-label="Reset zoom"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomOut();
              }}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-black"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: inspector */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 border-l border-line overflow-y-auto">
          <Inspector
            selection={selection}
            trigger={trigger}
            onTriggerChange={setTrigger}
            graph={graph}
            onNodeChange={updateNode}
            onNodeDelete={deleteNode}
            runs={initialRuns}
          />
        </aside>
      </div>
    </div>
  );
}

function CanvasSvg({
  edges,
  positions,
  endPositions,
}: {
  edges: LaidEdge[];
  positions: Map<string, LaidNode>;
  endPositions: Map<string, LaidNode>;
}) {
  const all = new Map<string, LaidNode>([
    ...positions.entries(),
    ...endPositions.entries(),
  ]);
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      style={{ overflow: "visible" }}
    >
      {edges.map((e, i) => {
        const from = all.get(e.fromId);
        const to = all.get(e.toId);
        if (!from || !to) return null;
        const x1 = from.x;
        const y1 = from.y + NODE_H;
        const x2 = to.x;
        const y2 = to.y;
        // Cubic bezier with a vertical control on both ends for a clean
        // bend on diagonal connectors.
        const mid = (y1 + y2) / 2;
        const path = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
        return (
          <g key={i}>
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              className="text-zinc-600"
            />
            {e.label && (
              <text
                x={(x1 + x2) / 2 + 6}
                y={mid - 4}
                className="text-[11px] fill-zinc-500"
                style={{ fontWeight: 600 }}
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CanvasNode({
  x,
  y,
  selected,
  onClick,
  icon,
  title,
  subtitle,
  accent,
}: {
  x: number;
  y: number;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: "blue";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "absolute text-left bg-card rounded-xl border transition-all px-3 py-2 flex items-center gap-2 shadow-sm -translate-x-1/2 " +
        (selected
          ? "border-primary ring-2 ring-primary/40"
          : accent === "blue"
            ? "border-blue-500/40 hover:border-blue-500"
            : "border-line hover:border-line-strong")
      }
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
    >
      <span
        className={
          "w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0 " +
          (accent === "blue" ? "bg-blue-500/15" : "bg-black")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white truncate">
          {title}
        </span>
        <span className="block text-xs text-zinc-400 truncate">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

function Inspector({
  selection,
  trigger,
  onTriggerChange,
  graph,
  onNodeChange,
  onNodeDelete,
  runs,
}: {
  selection: Selection;
  trigger: WorkflowTrigger;
  onTriggerChange: (t: WorkflowTrigger) => void;
  graph: WorkflowGraph;
  onNodeChange: (id: string, patch: Partial<WorkflowNode>) => void;
  onNodeDelete: (id: string) => void;
  runs: LeadWorkflowRun[];
}) {
  if (!selection) {
    return (
      <div className="p-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
          Inspector
        </div>
        <p className="text-sm text-zinc-400 mt-3">
          Click a node to edit it, or pick a step type from the left to add
          one.
        </p>
        <div className="mt-6 border-t border-line pt-4">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
            Run history
          </div>
          <RunHistory runs={runs} />
        </div>
      </div>
    );
  }

  if (selection.kind === "trigger") {
    return (
      <div className="p-4 space-y-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
          Inspector
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            Node Type
          </Label>
          <div className="bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-fg font-bold">
            When this happens
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            Trigger Event
          </Label>
          <div className="relative">
            {/* Native select kept: matches existing leads-page select pattern. */}
            <select
              value={trigger}
              onChange={(e) =>
                onTriggerChange(e.target.value as WorkflowTrigger)
              }
              className="w-full appearance-none bg-canvas border border-line-strong rounded-xl px-3 py-2 pr-9 text-sm text-fg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {WORKFLOW_TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
            Run history
          </div>
          <RunHistory runs={runs} />
        </div>
      </div>
    );
  }

  const node = graph.nodes[selection.nodeId];
  if (!node) return null;
  const meta = STEP_TYPES.find((t) => t.value === node.type);
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
          Inspector
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onNodeDelete(node.id)}
          className="h-auto p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-transparent"
          aria-label="Remove step"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Node Type
        </Label>
        <div className="bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-fg font-bold">
          {meta?.label || node.type}
        </div>
      </div>
      <NodeFields node={node} onChange={(patch) => onNodeChange(node.id, patch)} />
      <p className="text-xs text-zinc-500 pt-2 border-t border-line">
        Variables:{" "}
        <code className="text-zinc-300">{`{{first_name}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{last_name}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{phone}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{email}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{company_name}}`}</code>
      </p>
    </div>
  );
}

function NodeFields({
  node,
  onChange,
}: {
  node: WorkflowNode;
  onChange: (patch: Partial<WorkflowNode>) => void;
}) {
  if (node.type === "send_sms") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Message
        </Label>
        <Textarea
          value={node.message}
          onChange={(e) =>
            onChange({ message: e.target.value } as Partial<WorkflowNode>)
          }
          placeholder="Hi {{first_name}}, ..."
          rows={5}
        />
      </div>
    );
  }
  if (node.type === "delay") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Delay
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={node.minutes}
            onChange={(e) =>
              onChange({
                minutes: Math.max(1, Number(e.target.value) || 1),
              } as Partial<WorkflowNode>)
            }
            className="w-24 h-auto px-3 py-2 text-sm"
          />
          <span className="text-sm text-zinc-400 font-bold">minutes</span>
        </div>
        <p className="text-xs text-zinc-500">{prettyDelay(node.minutes)}</p>
      </div>
    );
  }
  if (node.type === "update_stage") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          New stage
        </Label>
        <div className="relative">
          {/* Native select kept: matches existing leads-page select pattern. */}
          <select
            value={node.stage}
            onChange={(e) =>
              onChange({
                stage: e.target.value as LeadStageSlug,
              } as Partial<WorkflowNode>)
            }
            className="w-full appearance-none bg-canvas border border-line-strong rounded-xl px-3 py-2 pr-9 text-sm text-fg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
      </div>
    );
  }
  if (node.type === "create_task") {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            Title
          </Label>
          <Input
            value={node.title}
            onChange={(e) =>
              onChange({ title: e.target.value } as Partial<WorkflowNode>)
            }
            placeholder="Task title"
            className="h-auto px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            Due in (minutes)
          </Label>
          <Input
            type="number"
            min={0}
            value={node.due_in_minutes ?? 0}
            onChange={(e) =>
              onChange({
                due_in_minutes: Math.max(0, Number(e.target.value) || 0),
              } as Partial<WorkflowNode>)
            }
            className="w-32 h-auto px-3 py-2 text-sm"
          />
        </div>
      </div>
    );
  }
  if (node.type === "notify_admin") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Message to org phone
        </Label>
        <Textarea
          value={node.message}
          onChange={(e) =>
            onChange({ message: e.target.value } as Partial<WorkflowNode>)
          }
          placeholder="New lead needs attention..."
          rows={4}
        />
      </div>
    );
  }
  if (node.type === "wait_for_reply") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Timeout (minutes)
        </Label>
        <Input
          type="number"
          min={1}
          value={node.timeout_minutes}
          onChange={(e) =>
            onChange({
              timeout_minutes: Math.max(1, Number(e.target.value) || 1),
            } as Partial<WorkflowNode>)
          }
          className="w-32 h-auto px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">
          Branches On Reply (lead texts back) or On Timeout (timer
          elapses). Edit the visual connectors to change destinations.
        </p>
      </div>
    );
  }
  if (node.type === "paths") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          If lead stage is
        </Label>
        <div className="relative">
          {/* Native select kept: matches existing app pattern. */}
          <select
            value={node.condition.stage}
            onChange={(e) =>
              onChange({
                condition: {
                  kind: "lead_stage_is",
                  stage: e.target.value as LeadStageSlug,
                },
              } as Partial<WorkflowNode>)
            }
            className="w-full appearance-none bg-canvas border border-line-strong rounded-xl px-3 py-2 pr-9 text-sm text-fg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
        <p className="text-xs text-zinc-500">
          Branches Yes (condition matches) or No (otherwise).
        </p>
      </div>
    );
  }
  return null;
}

function RunHistory({ runs }: { runs: LeadWorkflowRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-xs text-zinc-500 mt-3">
        No runs yet. Enroll a lead or wait for the trigger to fire.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {runs.slice(0, 8).map((r) => (
        <div
          key={r.id}
          className="text-xs border border-line rounded-lg px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-white font-bold">Lead #{r.lead_id}</span>
            <span className="text-zinc-500">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>
          <div className="text-zinc-400 mt-0.5">
            Step {r.step_index} · {r.status}
            {r.error ? ` · ${r.error}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function nodeSummary(node: WorkflowNode): string {
  if (node.type === "send_sms") {
    const t = node.message.trim();
    return t.length > 40 ? `${t.slice(0, 40)}…` : t || "(empty)";
  }
  if (node.type === "delay") return `Delay for ${prettyDelay(node.minutes)}`;
  if (node.type === "update_stage") return `Stage → ${node.stage}`;
  if (node.type === "create_task") return node.title || "Untitled task";
  if (node.type === "notify_admin") return "Notify org phone";
  if (node.type === "wait_for_reply")
    return `Timeout ${prettyDelay(node.timeout_minutes)}`;
  if (node.type === "paths")
    return `If lead stage is ${node.condition.stage}`;
  return "";
}

function prettyDelay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
  }
  const d = minutes / 1440;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} day${d === 1 ? "" : "s"}`;
}
