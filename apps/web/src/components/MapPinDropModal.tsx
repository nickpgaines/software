"use client";

import { useEffect, useState } from "react";
import { PIN_STATUS, type PinStatus } from "@/lib/map-pin-colors";

export default function MapPinDropModal({
  open,
  initialStatus,
  initialNote,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  initialStatus?: PinStatus;
  initialNote?: string;
  onCancel: () => void;
  onSubmit: (status: PinStatus, note: string) => void;
}) {
  const [status, setStatus] = useState<PinStatus | null>(initialStatus ?? null);
  const [note, setNote] = useState<string>(initialNote ?? "");

  useEffect(() => {
    if (open) {
      setStatus(initialStatus ?? null);
      setNote(initialNote ?? "");
    }
  }, [open, initialStatus, initialNote]);

  if (!open) return null;

  const entries = Object.entries(PIN_STATUS) as [
    PinStatus,
    (typeof PIN_STATUS)[PinStatus]
  ][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Drop pin</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a status and add a note (optional).
        </p>
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
            onClick={() => status && onSubmit(status, note)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Drop Pin
          </button>
        </div>
      </div>
    </div>
  );
}
