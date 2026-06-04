"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Employee = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
};

type Recurrence = "daily" | "weekly" | "biweekly" | "monthly";

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  const add = minutes >= 30 ? 60 - minutes : 30 - minutes;
  d.setMinutes(d.getMinutes() + add);
  return d;
}

function displayName(e: Employee): string {
  const full = [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
  return full || e.name || `Employee #${e.id}`;
}

export default function CreateTaskModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence>("weekly");
  const [assignTo, setAssignTo] = useState<"myself" | "employee">("myself");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [isTeamTask, setIsTeamTask] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDetails("");
    const start = nextHalfHour();
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    setStartAt(toLocalDatetimeInput(start));
    setEndAt(toLocalDatetimeInput(end));
    setIsRecurring(false);
    setRecurrence("weekly");
    setAssignTo("myself");
    setAssigneeId("");
    setIsTeamTask(false);
    setError(null);
    let cancelled = false;
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Employee[]) => {
        if (!cancelled) setEmployees(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Start and end times are required.");
      return;
    }
    const startIso = new Date(startAt).toISOString();
    const endIso = new Date(endAt).toISOString();
    if (Date.parse(endIso) < Date.parse(startIso)) {
      setError("End must be after start.");
      return;
    }
    setSubmitting(true);
    try {
      let payloadAssignee: number | null = null;
      const isTeam = assignTo === "employee" && isTeamTask;
      if (!isTeam && assignTo === "employee") {
        const id = Number(assigneeId);
        if (!Number.isFinite(id) || id <= 0) {
          setError("Pick an employee or choose Myself.");
          setSubmitting(false);
          return;
        }
        payloadAssignee = id;
      }
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          details: details.trim() || null,
          start_at: startIso,
          end_at: endIso,
          is_team_task: isTeam ? 1 : 0,
          assignee_user_id: payloadAssignee,
          recurrence: isRecurring ? recurrence : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Failed to create task");
        setSubmitting(false);
        return;
      }
      onCreated?.();
      onOpenChange(false);
    } catch {
      setError("Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Task Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-details">Task Details</Label>
            <Textarea
              id="task-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Enter task details (optional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-start">
                Start <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="task-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-end">
                End <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="task-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <Checkbox
                checked={isRecurring}
                onCheckedChange={(v) => setIsRecurring(v === true)}
              />
              Make this a recurring task
            </label>
            {isRecurring && (
              // Native select kept: empty-string sentinel isn't an issue here,
              // but every other select on this surface is native — matches
              // DESIGN_SYSTEM.md §10 deviation policy.
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                className="flex h-10 w-full rounded-md border border-line bg-card px-3 py-2 text-sm font-bold"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          <div className="border-t border-line pt-4 space-y-2">
            <Label>
              Assign Task To <span className="text-rose-500">*</span>
            </Label>
            <div className="flex items-center gap-6">
              {/* Native radio kept: no Radio primitive in the UI kit. */}
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="radio"
                  name="assign-to"
                  checked={assignTo === "myself"}
                  onChange={() => setAssignTo("myself")}
                />
                Myself
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="radio"
                  name="assign-to"
                  checked={assignTo === "employee"}
                  onChange={() => setAssignTo("employee")}
                />
                Employee
              </label>
            </div>
            {assignTo === "employee" && (
              <div className="space-y-2 pt-1">
                {!isTeamTask && (
                  // Native select kept: matches the rest of the app.
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-line bg-card px-3 py-2 text-sm font-bold"
                  >
                    <option value="">Select employee…</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {displayName(e)}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm font-bold">
                  <Checkbox
                    checked={isTeamTask}
                    onCheckedChange={(v) => setIsTeamTask(v === true)}
                  />
                  Make this a team task (visible to all organization members)
                </label>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm font-bold text-rose-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
