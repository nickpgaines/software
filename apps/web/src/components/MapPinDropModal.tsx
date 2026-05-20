"use client";

import {
  ChevronDown,
  Hammer,
  Hand,
  RefreshCw,
  Send,
  StickyNote,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  PIN_STATUS,
  filledGlyphSvg,
  type PinStatus,
} from "@/lib/map-pin-colors";
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

export type PinSubmitData = {
  status: PinStatus;
  note: string;
  objections: string[];
};

export type PinAction = "estimate" | "subscription" | "job" | "customer";

export default function MapPinDropModal({
  open,
  address,
  lat,
  lng,
  editingId,
  initialStatus,
  initialNote,
  initialObjections,
  onClose,
  onAction,
  onDelete,
}: {
  open: boolean;
  address?: string | null;
  lat?: number;
  lng?: number;
  editingId?: number;
  initialStatus?: PinStatus;
  initialNote?: string;
  initialObjections?: string[];
  onClose: (data: PinSubmitData) => void;
  onAction: (action: PinAction, data: PinSubmitData) => void;
  onDelete?: () => void;
}) {
  // Pin is "live" the moment the sheet opens: default status is Not home,
  // and closing without picking anything still persists this state.
  const [status, setStatus] = useState<PinStatus>(initialStatus ?? "not_home");
  const [note, setNote] = useState(initialNote ?? "");
  const [objections, setObjections] = useState<string[]>(
    initialObjections ?? []
  );
  const [objectionsOpen, setObjectionsOpen] = useState<boolean>(
    (initialObjections?.length ?? 0) > 0
  );

  useEffect(() => {
    if (open) {
      setStatus(initialStatus ?? "not_home");
      setNote(initialNote ?? "");
      setObjections(initialObjections ?? []);
      setObjectionsOpen((initialObjections?.length ?? 0) > 0);
    }
  }, [open, initialStatus, initialNote, initialObjections]);

  if (!open) return null;

  function snapshot(): PinSubmitData {
    return { status, note, objections };
  }

  function toggleObjection(o: string) {
    setObjections((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  }

  const entries = Object.entries(PIN_STATUS) as [
    PinStatus,
    (typeof PIN_STATUS)[PinStatus]
  ][];

  const coords =
    typeof lat === "number" && typeof lng === "number"
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : null;

  return (
    // Native bottom-sheet wrapper (DESIGN_SYSTEM.md §10 #22 — Dialog primitive
    // is centered-modal only).
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={() => onClose(snapshot())}
    >
      <div
        className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-card px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-line">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-white tracking-tight truncate">
              {address || "Drop pin"}
            </h2>
            {address && coords && (
              <p className="mt-0.5 text-xs text-zinc-500 truncate">{coords}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onClose(snapshot())}
            aria-label="Close"
            className="h-9 w-9 shrink-0 rounded-full border border-line p-0 text-zinc-400 hover:text-white hover:bg-black"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-4 overflow-x-auto pb-2 pt-1 -mx-1 px-1">
            {entries.map(([key, meta]) => {
              const active = status === key;
              // Match makeMarkerElement in MapClient.tsx (DESIGN_SYSTEM.md §8
              // "Door-knock map pins") so the picker swatches read as
              // miniatures of the actual map markers.
              const glow =
                `0 0 0 1px ${meta.color},` +
                `0 0 12px 2px ${meta.color}cc,` +
                `0 0 24px 4px ${meta.color}55,` +
                `0 2px 4px rgba(0,0,0,0.45)`;
              return (
                <Button
                  key={key}
                  type="button"
                  variant="ghost"
                  onClick={() => setStatus(key)}
                  className="shrink-0 h-auto flex-col items-center gap-2 w-20 px-1 py-1 hover:bg-transparent"
                  aria-pressed={active}
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: meta.color,
                      color: meta.textColor,
                      boxShadow: active ? glow : "none",
                      opacity: active ? 1 : 0.45,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: filledGlyphSvg(key, meta.textColor, 22),
                    }}
                  />
                  <span
                    className={
                      "text-[11px] text-center leading-tight " +
                      (active
                        ? "font-extrabold text-white"
                        : "font-bold text-zinc-400")
                    }
                  >
                    {meta.label}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-line">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setObjectionsOpen((v) => !v)}
              className="w-full h-auto justify-between gap-2 px-4 py-3 text-sm font-bold text-white tracking-tight rounded-b-none hover:bg-transparent"
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
                      <Label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-black font-normal">
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

          <Label className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 mb-1.5">
            <StickyNote className="h-3.5 w-3.5 text-zinc-400" />
            Notes
          </Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any additional notes..."
            rows={3}
            className="block w-full resize-none rounded-md border-line px-3 py-2 text-sm text-white placeholder:text-zinc-500 bg-transparent -mt-3"
          />

          <div className="space-y-2.5 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onAction("estimate", snapshot())}
              className="w-full h-auto rounded-full bg-sky-400 hover:bg-sky-300 text-slate-900 font-extrabold py-3 gap-2"
            >
              <Send className="h-4 w-4" />
              Quick Estimate
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onAction("job", snapshot())}
              className="w-full h-auto rounded-full bg-black border border-line text-white hover:bg-zinc-900 font-bold py-3 gap-2"
            >
              <Hammer className="h-4 w-4" />
              Create Job
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onAction("subscription", snapshot())}
              className="w-full h-auto rounded-full bg-black border border-line text-white hover:bg-zinc-900 font-bold py-3 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Create Subscription
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onAction("customer", snapshot())}
              className="w-full h-auto rounded-full bg-black border border-line text-white hover:bg-zinc-900 font-bold py-3 gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create Customer
            </Button>
          </div>

          {editingId != null && onDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm("Delete this pin?")) onDelete();
              }}
              className="w-full h-auto rounded-full bg-rose-500 hover:bg-rose-400 text-white font-extrabold py-3 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Pin
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
