"use client";

import { ChevronDown, Hand } from "lucide-react";
import { useEffect, useState } from "react";
import { PIN_STATUS, type PinStatus } from "@/lib/map-pin-colors";
import NewMenu from "./NewMenu";

const DEFAULT_OBJECTIONS = [
  "Spouse",
  "DIY",
  "Has a company",
  "Logistical (weather, construction, pollen, etc.)",
  "Card / think about it",
];

export default function MapPinDropModal({
  open,
  initialStatus,
  initialNote,
  initialObjections,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  initialStatus?: PinStatus;
  initialNote?: string;
  initialObjections?: string[];
  onCancel: () => void;
  onSubmit: (status: PinStatus, note: string, objections: string[]) => void;
}) {
  const [status, setStatus] = useState<PinStatus | null>(initialStatus ?? null);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [objections, setObjections] = useState<string[]>(
    initialObjections ?? []
  );
  const [objectionsOpen, setObjectionsOpen] = useState<boolean>(
    (initialObjections?.length ?? 0) > 0
  );

  useEffect(() => {
    if (open) {
      setStatus(initialStatus ?? null);
      setNote(initialNote ?? "");
      setObjections(initialObjections ?? []);
      setObjectionsOpen((initialObjections?.length ?? 0) > 0);
    }
  }, [open, initialStatus, initialNote, initialObjections]);

  if (!open) return null;

  function toggleObjection(o: string) {
    setObjections((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  }

  const entries = Object.entries(PIN_STATUS) as [
    PinStatus,
    (typeof PIN_STATUS)[PinStatus]
  ][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Drop pin</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a status and add a note (optional).
            </p>
          </div>
          <NewMenu />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {entries.map(([key, meta]) => {
            const Icon = meta.icon;
            const selected = status === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition border-2 " +
                  (selected ? "border-slate-900" : "border-transparent")
                }
                style={{ backgroundColor: meta.color, color: meta.textColor }}
              >
                <Icon className="h-4 w-4" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="mt-4 block w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
        />

        <div className="mt-4 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setObjectionsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-900"
          >
            <span className="flex items-center gap-2">
              <Hand className="h-4 w-4 text-slate-500" />
              Objections
              {objections.length > 0 && (
                <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {objections.length}
                </span>
              )}
            </span>
            <ChevronDown
              className={
                "h-4 w-4 text-slate-500 transition-transform " +
                (objectionsOpen ? "rotate-180" : "")
              }
            />
          </button>
          {objectionsOpen && (
            <ul className="border-t border-slate-100">
              {DEFAULT_OBJECTIONS.map((o) => {
                const checked = objections.includes(o);
                return (
                  <li
                    key={o}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-slate-900 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleObjection(o)}
                        className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                      />
                      <span className="font-medium">{o}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!status}
            onClick={() => status && onSubmit(status, note, objections)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Drop Pin
          </button>
        </div>
      </div>
    </div>
  );
}
