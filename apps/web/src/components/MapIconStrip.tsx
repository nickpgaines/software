"use client";

import {
  Hexagon,
  LoaderCircle,
  LocateFixed,
  Map as MapIcon,
  Pencil,
  Satellite,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type StyleMode = "satellite" | "streets";

export default function MapIconStrip({
  styleMode,
  onToggleStyle,
  drawingTerritory,
  onToggleDrawTerritory,
  territoryListOpen,
  onToggleTerritoryList,
  filterOpen,
  onToggleFilter,
  onLocate,
  locating,
}: {
  styleMode: StyleMode;
  onToggleStyle: () => void;
  drawingTerritory: boolean;
  onToggleDrawTerritory: () => void;
  territoryListOpen: boolean;
  onToggleTerritoryList: () => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  onLocate: () => void;
  locating: boolean;
}) {
  const satelliteActive = styleMode === "satellite";
  const StyleIcon = satelliteActive ? Satellite : MapIcon;

  // Individual circular floating buttons (Google/Uber style) rather than one
  // grouped bar — each is its own dark circle with a hairline + shadow so it
  // reads over satellite imagery.
  const circleBase =
    "h-11 w-11 p-0 rounded-full border border-line shadow-md transition-colors";
  const activeClasses = "!bg-slate-900 text-white hover:!bg-slate-800";
  const inactiveClasses = "bg-card text-zinc-300 hover:bg-black hover:text-white";

  return (
    <div
      className="absolute right-4 z-10 flex flex-col items-center gap-3"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      <Button
        variant="ghost"
        type="button"
        onClick={onToggleStyle}
        title="Toggle satellite view"
        aria-label="Toggle satellite view"
        className={
          circleBase +
          " " +
          (satelliteActive ? activeClasses : inactiveClasses)
        }
      >
        <StyleIcon className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={onToggleDrawTerritory}
        title={drawingTerritory ? "Cancel drawing" : "Draw territory"}
        aria-label={drawingTerritory ? "Cancel drawing territory" : "Draw territory"}
        aria-pressed={drawingTerritory}
        className={
          circleBase +
          " " +
          (drawingTerritory ? activeClasses : inactiveClasses)
        }
      >
        <Hexagon className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={onToggleTerritoryList}
        title="Edit territory"
        aria-label="Edit territory"
        aria-pressed={territoryListOpen}
        className={
          circleBase +
          " " +
          (territoryListOpen ? activeClasses : inactiveClasses)
        }
      >
        <Pencil className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={onToggleFilter}
        title="Filters"
        aria-label="Filters"
        aria-pressed={filterOpen}
        className={
          circleBase + " " + (filterOpen ? activeClasses : inactiveClasses)
        }
      >
        <SlidersHorizontal className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={onLocate}
        disabled={locating}
        aria-busy={locating}
        title="Center on my location"
        aria-label={locating ? "Locating…" : "Center on my location"}
        className={circleBase + " " + inactiveClasses}
      >
        {locating ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <LocateFixed className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
