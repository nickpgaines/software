"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import type { LeadWorkflow, LeadWorkflowRun } from "@/lib/db";
import {
  WORKFLOW_TRIGGERS,
  type WorkflowTrigger,
  type WorkflowTemplate,
} from "@/lib/lead-workflows-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TRIGGER_LABELS: Record<string, string> = Object.fromEntries(
  WORKFLOW_TRIGGERS.map((t) => [t.value, t.label])
);

export default function LeadsWorkflowsClient({
  initialWorkflows,
  initialRuns,
}: {
  initialWorkflows: LeadWorkflow[];
  initialRuns: LeadWorkflowRun[];
}) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<LeadWorkflow[]>(initialWorkflows);
  const [tab, setTab] = useState<"workflows" | "logs">("workflows");
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<WorkflowTrigger>("lead_created");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!showNew || templates.length) return;
    fetch("/api/lead-workflows/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((t: WorkflowTemplate[]) => setTemplates(t))
      .catch(() => {});
  }, [showNew, templates.length]);

  const total = workflows.length;
  const active = workflows.filter((w) => w.enabled).length;
  const paused = total - active;

  async function toggle(id: number, enabled: boolean) {
    const prev = workflows;
    setWorkflows((cur) =>
      cur.map((w) => (w.id === id ? { ...w, enabled: enabled ? 1 : 0 } : w))
    );
    try {
      const res = await fetch(`/api/lead-workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setWorkflows(prev);
    }
  }

  function pickTemplate(key: string) {
    setTemplateKey(key);
    const tpl = templates.find((t) => t.key === key);
    if (tpl) {
      setTrigger(tpl.trigger);
      if (!name.trim()) setName(tpl.name);
    }
  }

  async function createWorkflow() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/lead-workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          trigger,
          template_key: templateKey || undefined,
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as LeadWorkflow;
        setWorkflows((cur) => [...cur, created]);
        setName("");
        setTrigger("lead_created");
        setTemplateKey("");
        setShowNew(false);
        router.push(`/leads/workflows/${created.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-page-title text-white">Workflows</h2>
        <p className="text-sm text-zinc-400 font-bold">
          Automate follow-ups and lead nurturing sequences
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowNew(true)}
          className="h-auto gap-1.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-bold px-4 py-2 rounded-full"
        >
          <Plus className="w-4 h-4" />
          Add Workflow
        </Button>
      </div>

      <div className="overflow-x-auto scrollbar-none flex justify-center">
        <div className="bg-black rounded-full p-1 inline-flex items-center text-sm">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTab("workflows")}
            className={
              "h-auto whitespace-nowrap px-4 py-1.5 rounded-full hover:bg-transparent " +
              (tab === "workflows"
                ? "bg-card text-white shadow-sm font-bold"
                : "text-zinc-400 font-bold")
            }
          >
            Workflows
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTab("logs")}
            className={
              "h-auto whitespace-nowrap px-4 py-1.5 rounded-full hover:bg-transparent " +
              (tab === "logs"
                ? "bg-card text-white shadow-sm font-bold"
                : "text-zinc-400 font-bold")
            }
          >
            Workflow Logs
          </Button>
        </div>
      </div>

      {tab === "workflows" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat label="TOTAL" value={total} valueClass="text-white" />
            <Stat label="ACTIVE" value={active} valueClass="text-emerald-600" />
            <Stat label="PAUSED" value={paused} valueClass="text-white" />
          </div>

          <div className="space-y-3">
            {workflows.map((w) => (
              <WorkflowRow
                key={w.id}
                workflow={w}
                onToggle={(en) => toggle(w.id, en)}
              />
            ))}
          </div>
        </>
      ) : (
        <LogsTable runs={initialRuns} workflows={workflows} />
      )}

      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Add Workflow
            </h3>
            <p className="text-sm text-zinc-400 font-bold mt-1 mb-4">
              Pick a trigger and we&rsquo;ll create your first action step.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  Workflow Name
                </Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New lead follow-up"
                  className="h-auto px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  Trigger Event
                </Label>
                {/* Native select kept: matches the existing leads page pattern. */}
                <select
                  value={trigger}
                  onChange={(e) => {
                    setTrigger(e.target.value as WorkflowTrigger);
                    setTemplateKey("");
                  }}
                  className="w-full appearance-none bg-canvas border border-line-strong rounded-xl px-3 py-2 text-sm text-fg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {WORKFLOW_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                    Start from a template
                  </Label>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateKey("");
                      }}
                      className={
                        "w-full text-left px-3 py-2 rounded-xl border " +
                        (templateKey === ""
                          ? "border-primary text-white"
                          : "border-line text-zinc-300 hover:border-line-strong")
                      }
                    >
                      <div className="text-sm font-bold">Start from scratch</div>
                      <div className="text-xs text-zinc-400">
                        Empty workflow you build step by step.
                      </div>
                    </button>
                    {templates.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => pickTemplate(t.key)}
                        className={
                          "w-full text-left px-3 py-2 rounded-xl border " +
                          (templateKey === t.key
                            ? "border-primary text-white"
                            : "border-line text-zinc-300 hover:border-line-strong")
                        }
                      >
                        <div className="text-sm font-bold">{t.name}</div>
                        <div className="text-xs text-zinc-400">
                          {t.description}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {t.steps.length} steps ·{" "}
                          {TRIGGER_LABELS[t.trigger] || t.trigger}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNew(false)}
                className="h-auto px-4 py-2 text-sm text-zinc-400 font-bold hover:text-white hover:bg-transparent"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={createWorkflow}
                disabled={creating || !name.trim()}
                className="h-auto px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full font-bold"
              >
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="border border-line rounded-2xl p-5">
      <div className="text-xs font-bold text-zinc-400">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}

function WorkflowRow({
  workflow,
  onToggle,
}: {
  workflow: LeadWorkflow;
  onToggle: (enabled: boolean) => void;
}) {
  const enabled = !!workflow.enabled;
  const stepCount = (() => {
    try {
      const arr = JSON.parse(workflow.steps) as unknown[];
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  })();
  return (
    <Link
      href={`/leads/workflows/${workflow.id}`}
      className="block border border-line rounded-2xl p-4 hover:border-line-strong"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-extrabold text-white tracking-tight">
            {workflow.name}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            Trigger: {TRIGGER_LABELS[workflow.trigger] || workflow.trigger}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {stepCount} steps · Max/day {workflow.max_per_day}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={
              "text-xs px-3 py-1 rounded-full " +
              (enabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-black text-zinc-400")
            }
          >
            {enabled ? "Active" : "Paused"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={(e) => {
              e.preventDefault();
              onToggle(!enabled);
            }}
            className={
              "relative w-10 h-6 p-0 rounded-full " +
              (enabled ? "bg-emerald-500" : "bg-line-strong")
            }
          >
            <span
              className={
                "absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform " +
                (enabled ? "translate-x-4" : "")
              }
            />
          </button>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </div>
      </div>
    </Link>
  );
}

function LogsTable({
  runs,
  workflows,
}: {
  runs: LeadWorkflowRun[];
  workflows: LeadWorkflow[];
}) {
  if (runs.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-2xl p-12 text-center text-sm text-zinc-400 font-bold">
        No workflow runs yet. They&rsquo;ll appear here once a workflow is
        active and a lead matches its trigger.
      </div>
    );
  }
  const wfMap = new Map(workflows.map((w) => [w.id, w.name]));
  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <Table>
        <TableHeader className="bg-black text-xs font-bold text-zinc-400">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">
              Workflow
            </TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">
              Lead
            </TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">
              Step
            </TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">
              Status
            </TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">
              Created
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow
              key={r.id}
              className="border-t border-b-0 border-line hover:bg-transparent"
            >
              <TableCell className="px-4 py-3 text-white">
                {wfMap.get(r.workflow_id) || `#${r.workflow_id}`}
              </TableCell>
              <TableCell className="px-4 py-3 text-zinc-400">
                #{r.lead_id}
              </TableCell>
              <TableCell className="px-4 py-3 text-zinc-400">
                {r.step_index}
              </TableCell>
              <TableCell className="px-4 py-3 text-zinc-400">
                {r.status}
                {r.error ? ` — ${r.error}` : ""}
              </TableCell>
              <TableCell className="px-4 py-3 text-zinc-400 text-xs">
                {new Date(r.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
