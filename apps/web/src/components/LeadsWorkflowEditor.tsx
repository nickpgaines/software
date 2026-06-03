"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  MessageSquare,
  Clock,
  ArrowRightLeft,
  CheckSquare,
  Bell,
  Plus,
  Trash2,
  Save,
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState<number | null>(null);

  const triggerLabel = useMemo(
    () => WORKFLOW_TRIGGERS.find((t) => t.value === trigger)?.label || trigger,
    [trigger]
  );

  function updateStep(index: number, patch: Partial<WorkflowStep>) {
    setSteps((cur) => {
      const next = cur.slice();
      next[index] = { ...next[index], ...patch } as WorkflowStep;
      return next;
    });
  }

  function insertStep(at: number, type: WorkflowStepType) {
    setSteps((cur) => {
      const next = cur.slice();
      next.splice(at, 0, defaultStep(type));
      return next;
    });
    setShowAdd(null);
  }

  function removeStep(index: number) {
    setSteps((cur) => cur.filter((_, i) => i !== index));
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
      setTimeout(() => setSaved(null), 2000);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/leads/workflows"
            className="text-zinc-400 hover:text-white"
            aria-label="Back to workflows"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-extrabold bg-transparent border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white"
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
      {saved && (
        <div className="text-xs text-zinc-400 font-bold">{saved}</div>
      )}

      <div className="border border-line rounded-2xl p-5 space-y-3">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          When this happens
        </Label>
        <div className="relative">
          {/* Native select kept: Radix Select forbids empty-string item values
              and the trigger picker uses defaults. */}
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as WorkflowTrigger)}
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
        <p className="text-xs text-zinc-400">Trigger: {triggerLabel}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Steps
        </Label>
        <AddStepButton
          show={showAdd === 0}
          onToggle={() => setShowAdd(showAdd === 0 ? null : 0)}
          onPick={(t) => insertStep(0, t)}
        />
        {steps.map((step, i) => (
          <div key={i} className="space-y-2">
            <StepCard
              step={step}
              index={i}
              onChange={(patch) => updateStep(i, patch)}
              onRemove={() => removeStep(i)}
            />
            <AddStepButton
              show={showAdd === i + 1}
              onToggle={() => setShowAdd(showAdd === i + 1 ? null : i + 1)}
              onPick={(t) => insertStep(i + 1, t)}
            />
          </div>
        ))}
        {steps.length === 0 && (
          <div className="border border-dashed border-line rounded-2xl p-8 text-center text-sm text-zinc-400 font-bold">
            No steps yet. Add a step to define what this workflow does.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          Run history
        </Label>
        {initialRuns.length === 0 ? (
          <div className="border border-dashed border-line rounded-2xl p-8 text-center text-sm text-zinc-400 font-bold">
            No runs yet. Enroll a lead or wait for the trigger to fire.
          </div>
        ) : (
          <div className="border border-line rounded-2xl divide-y divide-line">
            {initialRuns.map((r) => (
              <div
                key={r.id}
                className="px-4 py-3 flex items-center justify-between text-sm"
              >
                <div className="text-white font-bold">Lead #{r.lead_id}</div>
                <div className="text-zinc-400">
                  Step {r.step_index} · {r.status}
                  {r.error ? ` · ${r.error}` : ""}
                </div>
                <div className="text-zinc-500 text-xs">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-zinc-500">
        Available variables in messages:{" "}
        <code className="text-zinc-300">{`{{first_name}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{last_name}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{phone}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{email}}`}</code>,{" "}
        <code className="text-zinc-300">{`{{company_name}}`}</code>
      </div>
    </div>
  );
}

function AddStepButton({
  show,
  onToggle,
  onPick,
}: {
  show: boolean;
  onToggle: () => void;
  onPick: (t: WorkflowStepType) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="h-auto gap-1.5 bg-black text-zinc-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add step
      </Button>
      {show && (
        <div className="w-full max-w-md border border-line rounded-2xl p-2 bg-card space-y-1">
          {STEP_TYPES.map((t) => {
            const Icon = STEP_ICONS[t.value];
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onPick(t.value)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-black"
              >
                <Icon className="w-4 h-4 text-zinc-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-bold">{t.label}</div>
                  <div className="text-xs text-zinc-400">{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: WorkflowStep;
  index: number;
  onChange: (patch: Partial<WorkflowStep>) => void;
  onRemove: () => void;
}) {
  const Icon = STEP_ICONS[step.type];
  const meta = STEP_TYPES.find((t) => t.value === step.type);
  return (
    <div className="border border-line rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-black text-zinc-400 text-xs font-bold inline-flex items-center justify-center">
            {index + 1}
          </span>
          <Icon className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-bold text-white truncate">
            {meta?.label}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onRemove}
          className="h-auto p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-transparent"
          aria-label="Remove step"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <StepFields step={step} onChange={onChange} />
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
      <Textarea
        value={step.message}
        onChange={(e) =>
          onChange({ message: e.target.value } as Partial<WorkflowStep>)
        }
        placeholder="Hi {{first_name}}, ..."
        rows={3}
      />
    );
  }
  if (step.type === "delay") {
    return (
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
        <span className="text-xs text-zinc-500">
          ({prettyDelay(step.minutes)})
        </span>
      </div>
    );
  }
  if (step.type === "update_stage") {
    return (
      <div className="relative max-w-xs">
        {/* Native select kept: matches existing leads-page select pattern. */}
        <select
          value={step.stage}
          onChange={(e) =>
            onChange({
              stage: e.target.value as "new" | "contacted" | "responded" | "estimate_sent",
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
    );
  }
  if (step.type === "create_task") {
    return (
      <div className="space-y-2">
        <Input
          value={step.title}
          onChange={(e) =>
            onChange({ title: e.target.value } as Partial<WorkflowStep>)
          }
          placeholder="Task title"
          className="h-auto px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-bold">Due in</span>
          <Input
            type="number"
            min={0}
            value={step.due_in_minutes ?? 0}
            onChange={(e) =>
              onChange({
                due_in_minutes: Math.max(0, Number(e.target.value) || 0),
              } as Partial<WorkflowStep>)
            }
            className="w-24 h-auto px-3 py-2 text-sm"
          />
          <span className="text-xs text-zinc-400 font-bold">minutes</span>
        </div>
      </div>
    );
  }
  if (step.type === "notify_admin") {
    return (
      <Textarea
        value={step.message}
        onChange={(e) =>
          onChange({ message: e.target.value } as Partial<WorkflowStep>)
        }
        placeholder="New lead needs attention..."
        rows={2}
      />
    );
  }
  return null;
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
