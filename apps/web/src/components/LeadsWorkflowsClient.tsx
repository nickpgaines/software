"use client";

import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import type { LeadWorkflow, LeadWorkflowRun } from "@/lib/db";

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
        <h2 className="text-xl font-semibold text-slate-900">Workflows</h2>
        <p className="text-sm text-slate-500">
          Automate follow-ups and lead nurturing sequences
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2 rounded-full"
        >
          <Plus className="w-4 h-4" />
          Add Workflow
        </button>
      </div>

      <div className="flex justify-center">
        <div className="bg-slate-100 rounded-full p-1 flex items-center text-sm">
          <button
            type="button"
            onClick={() => setTab("workflows")}
            className={
              "px-4 py-1.5 rounded-full " +
              (tab === "workflows"
                ? "bg-white text-slate-900 shadow-sm font-medium"
                : "text-slate-500")
            }
          >
            Workflows
          </button>
          <button
            type="button"
            onClick={() => setTab("logs")}
            className={
              "px-4 py-1.5 rounded-full " +
              (tab === "logs"
                ? "bg-white text-slate-900 shadow-sm font-medium"
                : "text-slate-500")
            }
          >
            Workflow Logs
          </button>
        </div>
      </div>

      {tab === "workflows" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat label="TOTAL" value={total} valueClass="text-slate-900" />
            <Stat label="ACTIVE" value={active} valueClass="text-emerald-600" />
            <Stat label="PAUSED" value={paused} valueClass="text-slate-900" />
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
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              New workflow
            </h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createWorkflow}
                className="px-4 py-2 text-sm bg-sky-400 hover:bg-sky-500 text-white rounded-full"
              >
                Create
              </button>
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
    <div className="border border-slate-200 rounded-2xl p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">
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
    <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold text-slate-900">{workflow.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          Trigger: A new lead is created
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {stepCount} steps &middot; Max/day {workflow.max_per_day}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={
            "text-xs px-3 py-1 rounded-full " +
            (enabled
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600")
          }
        >
          {enabled ? "Active" : "Paused"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={
            "relative w-10 h-6 rounded-full transition-colors " +
            (enabled ? "bg-emerald-500" : "bg-slate-300")
          }
        >
          <span
            className={
              "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " +
              (enabled ? "translate-x-4" : "")
            }
          />
        </button>
        <ChevronRight className="w-4 h-4 text-slate-400" />
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
      <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-500">
        No workflow runs yet. They&rsquo;ll appear here once a workflow is
        active and a lead matches its trigger.
      </div>
    );
  }
  const wfMap = new Map(workflows.map((w) => [w.id, w.name]));
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left px-4 py-3">Workflow</th>
            <th className="text-left px-4 py-3">Lead</th>
            <th className="text-left px-4 py-3">Step</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-slate-900">
                {wfMap.get(r.workflow_id) || `#${r.workflow_id}`}
              </td>
              <td className="px-4 py-3 text-slate-600">#{r.lead_id}</td>
              <td className="px-4 py-3 text-slate-600">{r.step_index}</td>
              <td className="px-4 py-3 text-slate-600">{r.status}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">
                {new Date(r.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
