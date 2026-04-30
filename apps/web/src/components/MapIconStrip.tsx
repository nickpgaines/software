"use client";

import { Map as MapIcon, Satellite } from "lucide-react";

type StyleMode = "satellite" | "streets";

export default function MapIconStrip({
  styleMode,
  onToggleStyle,
}: {
  styleMode: StyleMode;
  onToggleStyle: () => void;
}) {
  const satelliteActive = styleMode === "satellite";
  const Icon = satelliteActive ? Satellite : MapIcon;
  return (
    <div
      className="absolute top-4 right-4 z-10 flex w-12 flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-md"
    >
      <button
        type="button"
        onClick={onToggleStyle}
        title="Toggle satellite view"
        aria-label="Toggle satellite view"
        className={
          "flex h-10 w-10 items-center justify-center rounded-md transition-colors " +
          (satelliteActive
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
        }
      >
        <Icon className="h-5 w-5" />
      </button>
    </div>
  );
}
