"use client";

import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import type { LeadWorkflow, LeadWorkflowRun } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function LeadsWorkflowsClient({
  initialWorkflows,
  initialRuns,
}: {
  initialWorkflows: LeadWorkflow[];
  initialRuns: LeadWorkflowRun[];
}) {
  const [workflows, setWorkflows] = useState<LeadWorkflow[]>(initialWorkflows);
  const [tab, setTab] = useState<"workflows" | "logs">("workflows");
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

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

  async function createWorkflow() {
    if (!name.trim()) return;
    const res = await fetch("/api/lead-workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const created = (await res.json()) as LeadWorkflow;
      setWorkflows((cur) => [...cur, created]);
      setName("");
      setShowNew(false);
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
          className="h-auto gap-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-bold px-4 py-2 rounded-full"
        >
          <Plus className="w-4 h-4" />
          Add Workflow
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="bg-black rounded-full p-1 flex items-center text-sm">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTab("workflows")}
            className={
              "h-auto px-4 py-1.5 rounded-full hover:bg-transparent " +
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
              "h-auto px-4 py-1.5 rounded-full hover:bg-transparent " +
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
            <h3 className="text-lg font-extrabold text-white tracking-tight mb-4">
              New workflow
            </h3>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name"
              className="w-full h-auto border-line rounded-lg px-3 py-2 text-sm focus-visible:ring-line-strong"
            />
            <div className="flex justify-end gap-2 mt-4">
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
                className="h-auto px-4 py-2 text-sm bg-sky-400 hover:bg-sky-500 text-white rounded-full font-bold"
              >
                Create
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
      <div className="text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </div>
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
    <div className="border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
      <div>
        <div className="font-extrabold text-white tracking-tight">{workflow.name}</div>
        <div className="text-xs text-zinc-400 mt-0.5">
          Trigger: A new lead is created
        </div>
        <div className="text-xs text-zinc-400 mt-0.5">
          {stepCount} steps &middot; Max/day {workflow.max_per_day}
        </div>
      </div>
      <div className="flex items-center gap-3">
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
        <Button
          type="button"
          variant="ghost"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={
            "relative w-10 h-6 p-0 rounded-full hover:bg-current " +
            (enabled ? "bg-emerald-500 hover:bg-emerald-500" : "bg-line-strong hover:bg-line-strong")
          }
        >
          <span
            className={
              "absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform " +
              (enabled ? "translate-x-4" : "")
            }
          />
        </Button>
        <ChevronRight className="w-4 h-4 text-zinc-500" />
      </div>
    </div>
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
        <TableHeader className="bg-black text-xs uppercase text-zinc-400">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">Workflow</TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">Lead</TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">Step</TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">Status</TableHead>
            <TableHead className="h-auto text-left px-4 py-3 text-zinc-400">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id} className="border-t border-b-0 border-line hover:bg-transparent">
              <TableCell className="px-4 py-3 text-white">
                {wfMap.get(r.workflow_id) || `#${r.workflow_id}`}
              </TableCell>
              <TableCell className="px-4 py-3 text-zinc-400">#{r.lead_id}</TableCell>
              <TableCell className="px-4 py-3 text-zinc-400">{r.step_index}</TableCell>
              <TableCell className="px-4 py-3 text-zinc-400">{r.status}</TableCell>
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
