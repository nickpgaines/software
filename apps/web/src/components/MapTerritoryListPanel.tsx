"use client";

import { useMemo } from "react";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Territory = {
  id: number;
  name: string;
  color: string;
  polygon: number[][];
  assigned_employee_ids: number[];
};

type Staff = {
  id: number;
  name: string;
};

export default function MapTerritoryListPanel({
  version,
  territoriesRef,
  staff,
  onClose,
  onPick,
}: {
  version: number;
  territoriesRef: React.MutableRefObject<Map<number, Territory>>;
  staff: Staff[];
  onClose: () => void;
  onPick: (t: Territory) => void;
}) {
  const list = useMemo(
    () => Array.from(territoriesRef.current.values()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  function nameFor(t: Territory) {
    const id = t.assigned_employee_ids[0];
    if (id != null) {
      const s = staff.find((x) => x.id === id);
      if (s) return s.name;
    }
    return t.name || "Unassigned";
  }

  return (
    <div className="absolute top-4 right-16 z-10 w-72 max-h-[70vh] flex flex-col rounded-lg border border-[#1f1f24] bg-[#0f0f12] shadow-md">
      <div className="px-4 py-3 border-b border-[#1f1f24] flex items-center justify-between">
        <h3 className="font-extrabold text-white tracking-tight text-sm">Territories</h3>
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-auto w-auto p-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {list.length === 0 ? (
        <div className="px-4 py-6 text-sm text-zinc-400 font-bold text-center">
          No territories yet. Use the hexagon button to draw one.
        </div>
      ) : (
        <div className="overflow-y-auto">
          {list.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="ghost"
              onClick={() => onPick(t)}
              className="w-full h-auto justify-start gap-3 px-4 py-2.5 hover:bg-black text-left border-b border-slate-50 last:border-b-0 rounded-none"
            >
              <span
                className="w-4 h-4 rounded shrink-0"
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 text-sm text-white truncate">
                {nameFor(t)}
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
