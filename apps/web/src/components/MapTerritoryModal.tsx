"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { staffColorHex } from "@/lib/staff-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Staff = {
  id: number;
  name: string;
  role: string | null;
  color: string | null;
};

export type TerritoryDraft = {
  id?: number;
  name?: string;
  color?: string;
  polygon: number[][];
  assigned_employee_ids?: number[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MapTerritoryModal({
  draft,
  staff,
  onClose,
  onSaved,
  onDelete,
}: {
  draft: TerritoryDraft;
  staff: Staff[];
  onClose: () => void;
  onSaved: (saved: TerritoryDraft & { id: number }) => void;
  onDelete?: (id: number) => void;
}) {
  const initialId = draft.assigned_employee_ids?.[0] ?? null;
  const [staffId, setStaffId] = useState<number | null>(initialId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const picked = staff.find((s) => s.id === staffId) || null;
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => s.id !== staffId)
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [staff, staffId, query]);

  async function save() {
    setError(null);
    if (staffId == null || !picked) {
      setError("Pick an employee to assign this territory to");
      return;
    }
    setSaving(true);
    const payload = {
      name: picked.name,
      color: staffColorHex(picked.color),
      polygon: draft.polygon,
      assigned_employee_ids: [staffId],
    };
    const url = draft.id ? `/api/territories/${draft.id}` : "/api/territories";
    const method = draft.id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save territory");
      return;
    }
    const raw = (await res.json()) as Record<string, unknown>;
    const polygonField = raw.polygon;
    const idsField = raw.assigned_employee_ids;
    const saved: TerritoryDraft & { id: number } = {
      id: raw.id as number,
      name: (raw.name as string) || picked.name,
      color: (raw.color as string) || payload.color,
      polygon:
        typeof polygonField === "string"
          ? (JSON.parse(polygonField) as number[][])
          : (polygonField as number[][]) || draft.polygon,
      assigned_employee_ids:
        typeof idsField === "string"
          ? (JSON.parse(idsField) as number[])
          : (idsField as number[] | null) || [staffId],
    };
    onSaved(saved);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-[#0f0f12] rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-[#1f1f24] flex items-center justify-between">
          <h3 className="font-extrabold text-white tracking-tight">
            {draft.id ? "Reassign territory" : "Assign territory"}
          </h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div ref={ref} className="relative">
            <Label className="block text-xs font-normal uppercase tracking-wide text-zinc-500 mb-1.5">
              Assign to Employee
            </Label>
            <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 border border-[#1f1f24] rounded-2xl px-2 py-1.5 bg-[#0f0f12]">
              {picked && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: staffColorHex(picked.color) }}
                >
                  <span className="w-5 h-5 rounded-full bg-[#0f0f12]/30 flex items-center justify-center text-[10px] font-semibold">
                    {initials(picked.name)}
                  </span>
                  {picked.name}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStaffId(null)}
                    className="h-auto w-auto p-0 text-white/80 hover:text-white hover:bg-transparent"
                    aria-label={`Remove ${picked.name}`}
                  >
                    ×
                  </Button>
                </span>
              )}
              {!picked && (
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder="Search team…"
                  className="flex-1 h-auto min-w-[100px] outline-none text-sm bg-transparent px-2 border-0 focus-visible:ring-0"
                />
              )}
            </div>
            {open && !picked && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStaffId(s.id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full h-auto justify-start text-left px-4 py-2 hover:bg-black text-sm gap-2 rounded-none"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold text-white tracking-tight"
                      style={{ backgroundColor: staffColorHex(s.color) }}
                    >
                      {initials(s.name)}
                    </span>
                    {s.name}
                  </Button>
                ))}
              </div>
            )}
            <p className="text-eyebrow uppercase text-zinc-500 mt-2.5">
              The territory will use this employee&apos;s color on the map.
            </p>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-[#1f1f24] flex items-center justify-between gap-2">
          {draft.id && onDelete && (
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Delete this territory?")) onDelete(draft.id!);
              }}
              className="h-auto text-sm text-rose-600 hover:text-rose-700 hover:bg-transparent px-2"
            >
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-auto text-sm border border-[#1f1f24] bg-[#0f0f12] hover:bg-black rounded-full px-4 py-2 text-zinc-300 font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={save}
            disabled={saving || staffId == null}
            className="h-auto text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
          >
            {saving ? "Saving…" : draft.id ? "Save" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
