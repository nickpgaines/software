"use client";

import { ChevronDown, Hand } from "lucide-react";
import { useEffect, useState } from "react";
import { PIN_STATUS, type PinStatus } from "@/lib/map-pin-colors";
import NewMenu from "./NewMenu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">Drop pin</h2>
            <p className="mt-1 text-sm text-zinc-400 font-bold">
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
              <Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => setStatus(key)}
                className={
                  "h-auto justify-start gap-2 rounded-md px-3 py-2 text-sm font-bold border-2 hover:bg-current " +
                  (selected ? "border-slate-900" : "border-transparent")
                }
                style={{ backgroundColor: meta.color, color: meta.textColor }}
              >
                <Icon className="h-4 w-4" />
                <span>{meta.label}</span>
              </Button>
            );
          })}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="mt-4 block w-full resize-none rounded-md border-line px-3 py-2 text-sm text-white placeholder:text-zinc-500 bg-transparent focus-visible:border-slate-900"
        />

        <div className="mt-4 rounded-md border border-line">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setObjectionsOpen((v) => !v)}
            className="h-auto w-full justify-between gap-2 px-3 py-2 text-sm font-bold text-white tracking-tight rounded-b-none hover:bg-transparent"
          >
            <span className="flex items-center gap-2">
              <Hand className="h-4 w-4 text-zinc-400" />
              Objections
              {objections.length > 0 && (
                <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-extrabold text-white tracking-tight">
                  {objections.length}
                </span>
              )}
            </span>
            <ChevronDown
              className={
                "h-4 w-4 text-zinc-400 transition-transform " +
                (objectionsOpen ? "rotate-180" : "")
              }
            />
          </Button>
          {objectionsOpen && (
            <ul className="border-t border-line">
              {DEFAULT_OBJECTIONS.map((o) => {
                const checked = objections.includes(o);
                return (
                  <li
                    key={o}
                    className="border-b border-line last:border-b-0"
                  >
                    <Label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-black font-normal">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleObjection(o)}
                        className="border-line-strong"
                      />
                      <span className="font-bold">{o}</span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="h-auto rounded-md border border-line px-4 py-2 text-eyebrow uppercase text-zinc-500 hover:bg-black"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!status}
            onClick={() => status && onSubmit(status, note, objections)}
            className="h-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white tracking-tight hover:bg-slate-800"
          >
            Drop Pin
          </Button>
        </div>
      </div>
    </div>
  );
}
