"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import type { LeadWorkflow, LeadWorkflowRun } from "@/lib/db";
import {
  STEP_TYPES,
  WORKFLOW_TRIGGERS,
  defaultStep,
  parseSteps,
  type WorkflowStep,
  type WorkflowStepType,
  type WorkflowTrigger,
} from "@/lib/lead-workflows-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "estimate_sent", label: "Estimate sent" },
];

const STEP_ICONS: Record<WorkflowStepType, typeof MessageSquare> = {
  send_sms: MessageSquare,
  delay: Clock,
  update_stage: ArrowRightLeft,
  create_task: CheckSquare,
  notify_admin: Bell,
};

// Canvas geometry. Nodes are positioned along a vertical spine; connectors
// are SVG dashed lines drawn through the midpoint of each gap.
const NODE_W = 280;
const NODE_H = 76;
const NODE_GAP = 64;
const CANVAS_PAD_Y = 80;

type Selection =
  | { kind: "trigger" }
  | { kind: "step"; index: number }
  | null;

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
  const [steps, setSteps] = useState<WorkflowStep[]>(() =>
    parseSteps(initialWorkflow.steps)
  );
  const [selection, setSelection] = useState<Selection>({ kind: "trigger" });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-clear save toast
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  function updateStep(index: number, patch: Partial<WorkflowStep>) {
    setSteps((cur) => {
      const next = cur.slice();
      next[index] = { ...next[index], ...patch } as WorkflowStep;
      return next;
    });
  }

  function appendStep(type: WorkflowStepType) {
    setSteps((cur) => {
      const next = [...cur, defaultStep(type)];
      setSelection({ kind: "step", index: next.length - 1 });
      return next;
    });
  }

  function removeStep(index: number) {
    setSteps((cur) => cur.filter((_, i) => i !== index));
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
          steps: JSON.stringify(steps),
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

  function zoomIn() {
    setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  }
  function zoomOut() {
    setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
  }
  function zoomReset() {
    setZoom(1);
  }

  // Node Y positions: trigger at top, then steps stacked.
  const nodePositions = useMemo(() => {
    const positions: { y: number }[] = [];
    let y = CANVAS_PAD_Y;
    positions.push({ y });
    for (let i = 0; i < steps.length; i += 1) {
      y += NODE_H + NODE_GAP;
      positions.push({ y });
    }
    return positions;
  }, [steps.length]);

  const canvasHeight =
    (nodePositions[nodePositions.length - 1]?.y ?? CANVAS_PAD_Y) +
    NODE_H +
    CANVAS_PAD_Y;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="shrink-0 border-b border-line px-4 md:px-6 py-3 flex items-center justify-between gap-3">
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

      {/* Three-column body: sidebar | canvas | inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Left: step type palette */}
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
                onClick={() => appendStep(t.value)}
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
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-canvas"
          onClick={() => setSelection(null)}
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div
            className="relative origin-top mx-auto"
            style={{
              width: NODE_W + 240,
              height: canvasHeight,
              transform: `scale(${zoom})`,
            }}
          >
            {/* SVG connectors behind nodes */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height={canvasHeight}
            >
              {nodePositions.slice(0, -1).map((pos, i) => {
                const next = nodePositions[i + 1];
                const x = (NODE_W + 240) / 2;
                return (
                  <line
                    key={i}
                    x1={x}
                    y1={pos.y + NODE_H}
                    x2={x}
                    y2={next.y}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    className="text-zinc-600"
                  />
                );
              })}
              {/* END marker line */}
              {nodePositions.length > 0 && (
                <line
                  x1={(NODE_W + 240) / 2}
                  y1={nodePositions[nodePositions.length - 1].y + NODE_H}
                  x2={(NODE_W + 240) / 2}
                  y2={
                    nodePositions[nodePositions.length - 1].y +
                    NODE_H +
                    CANVAS_PAD_Y / 2
                  }
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  className="text-zinc-600"
                />
              )}
            </svg>

            {/* Trigger node */}
            <CanvasNode
              x={120}
              y={nodePositions[0].y}
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
            {steps.map((step, i) => {
              const pos = nodePositions[i + 1];
              const Icon = STEP_ICONS[step.type];
              const meta = STEP_TYPES.find((t) => t.value === step.type);
              return (
                <CanvasNode
                  key={i}
                  x={120}
                  y={pos.y}
                  selected={
                    selection?.kind === "step" && selection.index === i
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ kind: "step", index: i });
                  }}
                  icon={<Icon className="w-4 h-4 text-zinc-300" />}
                  title={meta?.label || step.type}
                  subtitle={stepSummary(step)}
                />
              );
            })}

            {/* END pill */}
            <div
              className="absolute -translate-x-1/2"
              style={{
                left: (NODE_W + 240) / 2,
                top:
                  (nodePositions[nodePositions.length - 1]?.y ?? 0) +
                  NODE_H +
                  CANVAS_PAD_Y / 2,
              }}
            >
              <div className="text-[10px] font-bold tracking-wider text-zinc-500 bg-black px-3 py-1 rounded-full border border-line">
                END
              </div>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1 bg-card border border-line rounded-xl p-1">
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
            steps={steps}
            onStepChange={updateStep}
            onStepRemove={removeStep}
            runs={initialRuns}
          />
        </aside>
      </div>
    </div>
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
        "absolute text-left bg-card rounded-xl border transition-all px-4 py-3 flex items-center gap-3 shadow-sm " +
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
  steps,
  onStepChange,
  onStepRemove,
  runs,
}: {
  selection: Selection;
  trigger: WorkflowTrigger;
  onTriggerChange: (t: WorkflowTrigger) => void;
  steps: WorkflowStep[];
  onStepChange: (i: number, patch: Partial<WorkflowStep>) => void;
  onStepRemove: (i: number) => void;
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
            {/* Native select kept: matches existing app pattern. */}
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

  const step = steps[selection.index];
  if (!step) return null;
  const meta = STEP_TYPES.find((t) => t.value === step.type);
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
          Inspector
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onStepRemove(selection.index)}
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
          {meta?.label || step.type}
        </div>
      </div>
      <StepFields
        step={step}
        onChange={(patch) => onStepChange(selection.index, patch)}
      />
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

function StepFields({
  step,
  onChange,
}: {
  step: WorkflowStep;
  onChange: (patch: Partial<WorkflowStep>) => void;
}) {
  if (step.type === "send_sms") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Message
        </Label>
        <Textarea
          value={step.message}
          onChange={(e) =>
            onChange({ message: e.target.value } as Partial<WorkflowStep>)
          }
          placeholder="Hi {{first_name}}, ..."
          rows={5}
        />
      </div>
    );
  }
  if (step.type === "delay") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Delay
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={step.minutes}
            onChange={(e) =>
              onChange({
                minutes: Math.max(1, Number(e.target.value) || 1),
              } as Partial<WorkflowStep>)
            }
            className="w-24 h-auto px-3 py-2 text-sm"
          />
          <span className="text-sm text-zinc-400 font-bold">minutes</span>
        </div>
        <p className="text-xs text-zinc-500">{prettyDelay(step.minutes)}</p>
      </div>
    );
  }
  if (step.type === "update_stage") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          New stage
        </Label>
        <div className="relative">
          {/* Native select kept: matches existing app pattern. */}
          <select
            value={step.stage}
            onChange={(e) =>
              onChange({
                stage: e.target.value as
                  | "new"
                  | "contacted"
                  | "responded"
                  | "estimate_sent",
              } as Partial<WorkflowStep>)
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
  if (step.type === "create_task") {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            Title
          </Label>
          <Input
            value={step.title}
            onChange={(e) =>
              onChange({ title: e.target.value } as Partial<WorkflowStep>)
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
            value={step.due_in_minutes ?? 0}
            onChange={(e) =>
              onChange({
                due_in_minutes: Math.max(0, Number(e.target.value) || 0),
              } as Partial<WorkflowStep>)
            }
            className="w-32 h-auto px-3 py-2 text-sm"
          />
        </div>
      </div>
    );
  }
  if (step.type === "notify_admin") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Message to org phone
        </Label>
        <Textarea
          value={step.message}
          onChange={(e) =>
            onChange({ message: e.target.value } as Partial<WorkflowStep>)
          }
          placeholder="New lead needs attention..."
          rows={4}
        />
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

function stepSummary(step: WorkflowStep): string {
  if (step.type === "send_sms") {
    const t = step.message.trim();
    return t.length > 48 ? `${t.slice(0, 48)}…` : t || "(empty)";
  }
  if (step.type === "delay") return `Delay for ${prettyDelay(step.minutes)}`;
  if (step.type === "update_stage") return `Stage → ${step.stage}`;
  if (step.type === "create_task") return step.title || "Untitled task";
  if (step.type === "notify_admin") return "Notify org phone";
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
