"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Users, Plus, Minus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StaffRow = {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  color: string | null;
  photo_url: string | null;
};

type ShiftRow = {
  id: number;
  staff_id: number;
  work_date: string;
  start_minutes: number;
  end_minutes: number;
};

type DefaultShiftRow = {
  id: number;
  staff_id: number;
  weekday: number;
  start_minutes: number;
  end_minutes: number;
};

type ApiResponse = {
  staff: StaffRow[];
  shifts: ShiftRow[];
  defaults: DefaultShiftRow[];
};

type CellShift = {
  start_minutes: number;
  end_minutes: number;
  source: "shift" | "default";
};

const DEFAULT_START = 9 * 60; // 9 AM
const DEFAULT_END = 17 * 60; // 5 PM

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startLabel = start.toLocaleDateString(undefined, opts);
  const endLabel = end.toLocaleDateString(undefined, {
    ...opts,
    year: sameYear ? undefined : "numeric",
  });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

function formatTimeShort(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "p" : "a";
  const h12 = ((h24 + 11) % 12) + 1;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

function formatTimeLong(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function staffName(s: StaffRow): string {
  const fn = (s.first_name || "").trim();
  const ln = (s.last_name || "").trim();
  const joined = [fn, ln].filter(Boolean).join(" ").trim();
  return joined || (s.name || "").trim() || `Staff #${s.id}`;
}

function staffInitial(s: StaffRow): string {
  return staffName(s).charAt(0).toUpperCase() || "?";
}

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  gray: "bg-slate-400",
};

function colorClass(s: StaffRow): string {
  return COLOR_CLASSES[s.color || "blue"] || COLOR_CLASSES.blue;
}

export default function EmployeeSchedulingModal({
  open,
  onClose,
  initialDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: Date;
  onSaved?: () => void;
}) {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(initialDate));
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local edits: keyed by `${staff_id}:${dateIso}`. Maps to shift or null
  // (null = remove) or undefined (no change).
  const [drafts, setDrafts] = useState<
    Record<string, { start_minutes: number; end_minutes: number } | null>
  >({});

  // Selected cell keys for bulk editing.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Which staff are currently included in the grid.
  const [activeStaffIds, setActiveStaffIds] = useState<Set<number>>(new Set());
  const [staffSearch, setStaffSearch] = useState("");
  const [asDefault, setAsDefault] = useState(false);

  useEffect(() => {
    if (open) {
      setWeekStart(startOfWeek(initialDate));
      setDrafts({});
      setSelected(new Set());
      setStaffSearch("");
      setAsDefault(false);
      setError(null);
    }
  }, [open, initialDate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const start = isoDate(weekStart);
    const end = isoDate(addDays(weekStart, 6));
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/schedule/shifts?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (cancelled) return;
        setData(d);
        // Auto-include staff that have any shift this week or any default.
        const ids = new Set<number>();
        for (const s of d.shifts) ids.add(s.staff_id);
        for (const ds of d.defaults) ids.add(ds.staff_id);
        setActiveStaffIds(ids);
      })
      .catch((e) => !cancelled && setError(String((e as Error).message)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Resolve effective shift for a (staff, day) cell, applying drafts on top
  // of server data.
  function effectiveShift(staffId: number, date: Date): CellShift | null {
    const dateIso = isoDate(date);
    const key = `${staffId}:${dateIso}`;
    if (key in drafts) {
      const v = drafts[key];
      if (v === null) return null;
      return { ...v, source: "shift" };
    }
    if (!data) return null;
    const explicit = data.shifts.find(
      (s) => s.staff_id === staffId && s.work_date === dateIso
    );
    if (explicit) {
      return {
        start_minutes: explicit.start_minutes,
        end_minutes: explicit.end_minutes,
        source: "shift",
      };
    }
    const def = data.defaults.find(
      (d) => d.staff_id === staffId && d.weekday === date.getDay()
    );
    if (def) {
      return {
        start_minutes: def.start_minutes,
        end_minutes: def.end_minutes,
        source: "default",
      };
    }
    return null;
  }

  function toggleCell(staffId: number, date: Date) {
    const key = `${staffId}:${isoDate(date)}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleStaffRow(staffId: number) {
    const keys = days.map((d) => `${staffId}:${isoDate(d)}`);
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function selectMonFri() {
    const next = new Set<string>();
    for (const id of activeStaffIds) {
      for (let i = 1; i <= 5; i++) {
        next.add(`${id}:${isoDate(addDays(weekStart, i))}`);
      }
    }
    setSelected(next);
  }

  function selectAll() {
    const next = new Set<string>();
    for (const id of activeStaffIds) {
      for (const d of days) next.add(`${id}:${isoDate(d)}`);
    }
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // The bulk editor's current draft hours. If selection is non-empty, derive
  // from the first selected cell (or 9–5 if none have a shift).
  const [bulkStart, setBulkStart] = useState(DEFAULT_START);
  const [bulkEnd, setBulkEnd] = useState(DEFAULT_END);

  useEffect(() => {
    if (selected.size === 0) return;
    const first = selected.values().next().value as string;
    const [staffStr, dateIso] = first.split(":");
    const staffId = Number(staffStr);
    const [y, m, d] = dateIso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const cur = effectiveShift(staffId, date);
    if (cur) {
      setBulkStart(cur.start_minutes);
      setBulkEnd(cur.end_minutes);
    } else {
      setBulkStart(DEFAULT_START);
      setBulkEnd(DEFAULT_END);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function applyBulk(start: number, end: number) {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const key of selected) {
        next[key] = { start_minutes: start, end_minutes: end };
      }
      return next;
    });
  }

  function removeSelected() {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const key of selected) next[key] = null;
      return next;
    });
    setSelected(new Set());
  }

  function adjustBulk(side: "start" | "end", delta: number) {
    const stepMin = 60; // 1 hour
    if (side === "start") {
      const next = Math.max(0, Math.min(24 * 60 - 60, bulkStart + delta * stepMin));
      setBulkStart(next);
      if (next >= bulkEnd) setBulkEnd(Math.min(24 * 60, next + 60));
      applyBulk(next, Math.max(next + 60, bulkEnd));
    } else {
      const next = Math.max(60, Math.min(24 * 60, bulkEnd + delta * stepMin));
      setBulkEnd(next);
      if (next <= bulkStart) setBulkStart(Math.max(0, next - 60));
      applyBulk(Math.min(bulkStart, next - 60), next);
    }
  }

  function addEmployee(staffId: number) {
    setActiveStaffIds((prev) => new Set(prev).add(staffId));
    setStaffSearch("");
  }

  function removeEmployee(staffId: number) {
    setActiveStaffIds((prev) => {
      const next = new Set(prev);
      next.delete(staffId);
      return next;
    });
    // Drop drafts and selections for this staff member.
    setDrafts((prev) => {
      const next: typeof prev = {};
      for (const k of Object.keys(prev)) {
        if (!k.startsWith(`${staffId}:`)) next[k] = prev[k];
      }
      return next;
    });
    setSelected((prev) => {
      const next = new Set<string>();
      for (const k of prev) if (!k.startsWith(`${staffId}:`)) next.add(k);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const upserts: {
      staff_id: number;
      work_date: string;
      start_minutes: number;
      end_minutes: number;
    }[] = [];
    const removals: { staff_id: number; work_date: string }[] = [];
    for (const [key, value] of Object.entries(drafts)) {
      const [staffStr, work_date] = key.split(":");
      const staff_id = Number(staffStr);
      if (value === null) {
        removals.push({ staff_id, work_date });
      } else {
        upserts.push({
          staff_id,
          work_date,
          start_minutes: value.start_minutes,
          end_minutes: value.end_minutes,
        });
      }
    }
    try {
      const res = await fetch(`/api/schedule/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upserts, removals, as_default: asDefault }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Save failed (${res.status})`);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const allStaff = data?.staff || [];
  const activeStaff = allStaff.filter((s) => activeStaffIds.has(s.id));
  const candidateStaff = allStaff.filter((s) => {
    if (activeStaffIds.has(s.id)) return false;
    if (!staffSearch.trim()) return true;
    return staffName(s).toLowerCase().includes(staffSearch.trim().toLowerCase());
  });

  const totalShifts = activeStaff.reduce((sum, s) => {
    return (
      sum +
      days.reduce((c, d) => (effectiveShift(s.id, d) ? c + 1 : c), 0)
    );
  }, 0);
  const employeeCount = activeStaff.filter((s) =>
    days.some((d) => effectiveShift(s.id, d))
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative bg-[#0f0f12] rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0f0f12] border-b border-[#1f1f24] px-6 py-5 flex items-start justify-between z-10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-zinc-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-page-title text-white">
                Employee Scheduling
              </h2>
              <p className="text-sm text-zinc-400 mt-3 font-bold">
                Set who&rsquo;s working and their shift hours.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto w-auto text-zinc-500 hover:text-zinc-300 hover:bg-transparent p-1 -m-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="w-8 h-8 p-0 rounded-full hover:bg-black text-zinc-400"
              aria-label="Previous week"
            >
              ‹
            </Button>
            <div className="text-base font-bold text-white tracking-tight">
              {formatRange(weekStart, addDays(weekStart, 6))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="w-8 h-8 p-0 rounded-full hover:bg-black text-zinc-400"
              aria-label="Next week"
            >
              ›
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={selectMonFri}
                className="h-auto p-0 text-sky-600 hover:text-sky-800 hover:bg-transparent font-bold"
              >
                Select Mon–Fri
              </Button>
              <Button
                variant="ghost"
                onClick={selectAll}
                className="h-auto p-0 text-sky-600 hover:text-sky-800 hover:bg-transparent font-bold"
              >
                Select All
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={clearSelection}
              className="h-auto p-0 text-zinc-400 hover:text-zinc-300 hover:bg-transparent font-bold"
            >
              Clear
            </Button>
          </div>

          <div className="border border-[#1f1f24] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[160px_repeat(7,1fr)] bg-black text-[11px] uppercase tracking-wider text-zinc-400">
              <div className="px-3 py-3">Employee</div>
              {days.map((d) => {
                const isToday = isoDate(d) === isoDate(new Date());
                return (
                  <div
                    key={d.toISOString()}
                    className={
                      "px-2 py-3 text-center " +
                      (isToday ? "text-sky-600 font-semibold" : "")
                    }
                  >
                    <div>
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="text-base font-extrabold text-white tracking-tight mt-0.5">
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeStaff.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-zinc-500">
                Add an employee below to get started.
              </div>
            )}

            {activeStaff.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[160px_repeat(7,1fr)] border-t border-[#1f1f24] items-center"
              >
                <button
                  onClick={() => toggleStaffRow(s.id)}
                  className="flex items-center gap-2 px-3 py-2 text-left hover:bg-black"
                >
                  <span
                    className={
                      "w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center " +
                      colorClass(s)
                    }
                  >
                    {staffInitial(s)}
                  </span>
                  <span className="text-sm font-bold text-white tracking-tight truncate">
                    {staffName(s)}
                  </span>
                </button>
                {days.map((d) => {
                  const key = `${s.id}:${isoDate(d)}`;
                  const sel = selected.has(key);
                  const sh = effectiveShift(s.id, d);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleCell(s.id, d)}
                      className={
                        "relative m-1 rounded-lg px-1 py-2 text-xs transition border " +
                        (sel
                          ? "border-sky-500 ring-2 ring-sky-200 bg-sky-50"
                          : sh
                          ? sh.source === "default"
                            ? "border-[#1f1f24] bg-[#0f0f12] text-zinc-400"
                            : "border-[#1f1f24] bg-[#0f0f12] text-zinc-300"
                          : "border-dashed border-[#1f1f24] bg-[#0f0f12] text-zinc-500 hover:text-zinc-400")
                      }
                    >
                      {sh ? (
                        <span className="font-bold">
                          {formatTimeShort(sh.start_minutes)}–
                          {formatTimeShort(sh.end_minutes)}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                      {sel && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 mb-2">
              <Users className="w-3.5 h-3.5" /> Add employees
            </div>
            <div className="relative mb-2">
              <Input
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search employees…"
                className="w-full h-auto bg-[#0f0f12] border-[#1f1f24] rounded-full pl-10 pr-4 py-2.5 text-sm focus-visible:ring-[#2a2a32]"
              />
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              {staffSearch && candidateStaff.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                  {candidateStaff.slice(0, 12).map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant="ghost"
                      onClick={() => addEmployee(s.id)}
                      className="w-full h-auto justify-start gap-2 px-4 py-2 text-sm text-left hover:bg-black rounded-none"
                    >
                      <span
                        className={
                          "w-6 h-6 rounded-full text-white text-[10px] font-semibold flex items-center justify-center " +
                          colorClass(s)
                        }
                      >
                        {staffInitial(s)}
                      </span>
                      <span>{staffName(s)}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeStaff.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-full pl-1 pr-2 py-1 text-xs text-zinc-300"
                >
                  <span
                    className={
                      "w-5 h-5 rounded-full text-white text-[10px] font-semibold flex items-center justify-center " +
                      colorClass(s)
                    }
                  >
                    {staffInitial(s)}
                  </span>
                  <span>{staffName(s)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeEmployee(s.id)}
                    className="h-auto w-auto p-0 text-zinc-500 hover:text-rose-600 hover:bg-transparent"
                    aria-label={`Remove ${staffName(s)}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </span>
              ))}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4">
              <div className="text-center text-xs uppercase tracking-wider text-sky-700 font-semibold">
                Edit {selected.size} selected shift{selected.size === 1 ? "" : "s"}
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <TimeStepper
                  value={bulkStart}
                  onChange={(v) => {
                    setBulkStart(v);
                    applyBulk(v, Math.max(v + 60, bulkEnd));
                  }}
                  onAdjust={(d) => adjustBulk("start", d)}
                />
                <span className="text-sm text-zinc-400 font-bold">to</span>
                <TimeStepper
                  value={bulkEnd}
                  onChange={(v) => {
                    setBulkEnd(v);
                    applyBulk(Math.min(bulkStart, v - 60), v);
                  }}
                  onAdjust={(d) => adjustBulk("end", d)}
                />
              </div>
              <div className="text-center mt-2">
                <Button
                  variant="ghost"
                  onClick={removeSelected}
                  className="h-auto p-0 text-sm text-rose-600 hover:text-rose-700 hover:bg-transparent font-bold"
                >
                  Remove {selected.size} shift{selected.size === 1 ? "" : "s"}
                </Button>
              </div>
              <p className="text-center text-xs text-zinc-400 mt-2">
                Tap cells to select &middot; tap again to deselect &middot; click an
                employee name to select the entire row.
              </p>
            </div>
          )}

          <Label className="flex items-center justify-between gap-4 bg-black border border-[#1f1f24] rounded-2xl px-4 py-3 cursor-pointer font-normal">
            <div>
              <div className="text-sm font-extrabold text-white tracking-tight">
                Set as default schedule
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Apply these hours to every week going forward, until
                modified again.
              </p>
            </div>
            <Checkbox
              checked={asDefault}
              onCheckedChange={(c) => setAsDefault(c === true)}
              className="w-5 h-5 cursor-pointer"
            />
          </Label>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#0f0f12] border-t border-[#1f1f24] px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-400 font-bold">
            {employeeCount} employee{employeeCount === 1 ? "" : "s"} &middot;{" "}
            {totalShifts} shift{totalShifts === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-auto px-4 py-2 text-eyebrow uppercase text-zinc-500 bg-[#0f0f12] border border-[#1f1f24] rounded-full hover:bg-black"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={save}
              disabled={saving || loading}
              className="h-auto px-5 py-2 text-sm font-bold text-white tracking-tight bg-sky-500 hover:bg-sky-600 rounded-full shadow-sm"
            >
              {saving ? "Saving…" : "Apply to Schedule"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeStepper({
  value,
  onChange,
  onAdjust,
}: {
  value: number;
  onChange: (v: number) => void;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onAdjust(-1)}
        className="w-8 h-8 p-0 rounded-full bg-[#0f0f12] border border-[#1f1f24] hover:bg-black text-zinc-400"
        aria-label="Earlier"
      >
        <Minus className="w-3.5 h-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChange(value)}
        className="h-auto min-w-[64px] px-2 py-1 text-[15px] font-extrabold tracking-tight text-sky-700 hover:bg-transparent"
      >
        {formatTimeLong(value)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onAdjust(1)}
        className="w-8 h-8 p-0 rounded-full bg-[#0f0f12] border border-[#1f1f24] hover:bg-black text-zinc-400"
        aria-label="Later"
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
