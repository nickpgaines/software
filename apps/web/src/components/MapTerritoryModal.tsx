"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TERRITORY_COLORS } from "@/lib/map-status";

export type Staff = { id: number; name: string; role: string | null };

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
  const [name, setName] = useState(draft.name || "");
  const [color, setColor] = useState(draft.color || TERRITORY_COLORS[0]);
  const [staffIds, setStaffIds] = useState<number[]>(
    draft.assigned_employee_ids || []
  );
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

  const picked = staff.filter((s) => staffIds.includes(s.id));
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => !staffIds.includes(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [staff, staffIds, query]);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Territory name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      color,
      polygon: draft.polygon,
      assigned_employee_ids: staffIds,
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
    const saved = (await res.json()) as TerritoryDraft & { id: number };
    onSaved(saved);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            {draft.id ? "Edit territory" : "Name this territory"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Territory Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North side"
              className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm"
              autoFocus
            />
          </Field>

          <Field label="Color">
            <div className="flex gap-2 flex-wrap">
              {TERRITORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={
                    "w-9 h-9 rounded-xl transition " +
                    (color === c ? "ring-2 ring-offset-2 ring-slate-900" : "")
                  }
                  style={{ backgroundColor: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
            </div>
          </Field>

          <div ref={ref} className="relative">
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1.5">
              Assign Employees (Optional)
            </label>
            <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 border border-slate-200 rounded-2xl px-2 py-1.5 bg-white">
              {picked.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full pl-1 pr-2 py-0.5 text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] font-semibold">
                    {initials(s.name)}
                  </span>
                  {s.name}
                  <button
                    type="button"
                    onClick={() =>
                      setStaffIds(staffIds.filter((id) => id !== s.id))
                    }
                    className="text-slate-400 hover:text-slate-700"
                    aria-label={`Remove ${s.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder={picked.length === 0 ? "Search team…" : ""}
                className="flex-1 min-w-[100px] outline-none text-sm bg-transparent px-2"
              />
            </div>
            {open && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStaffIds([...staffIds, s.id]);
                      setQuery("");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm flex items-center gap-2"
                  >
                    <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-semibold">
                      {initials(s.name)}
                    </span>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1.5">
              You can assign employees later if needed.
            </p>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {draft.id && onDelete && (
            <button
              onClick={() => {
                if (confirm("Delete this territory?")) onDelete(draft.id!);
              }}
              className="text-sm text-rose-600 hover:text-rose-700 px-2"
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-slate-200 bg-white hover:bg-slate-50 rounded-full px-4 py-2 text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-medium"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
