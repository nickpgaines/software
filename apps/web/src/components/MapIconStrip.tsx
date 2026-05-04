"use client";

import {
  Hexagon,
  Lasso,
  Map as MapIcon,
  MapPin,
  Pencil,
  Satellite,
  SlidersHorizontal,
  Users,
} from "lucide-react";

type StyleMode = "satellite" | "streets";

export default function MapIconStrip({
  styleMode,
  onToggleStyle,
  pinsVisible,
  onTogglePins,
  customerPinsVisible,
  onToggleCustomerPins,
  drawingTerritory,
  onToggleDrawTerritory,
  territoryListOpen,
  onToggleTerritoryList,
  filterOpen,
  onToggleFilter,
  drawingLasso,
  onToggleLasso,
}: {
  styleMode: StyleMode;
  onToggleStyle: () => void;
  pinsVisible: boolean;
  onTogglePins: () => void;
  customerPinsVisible: boolean;
  onToggleCustomerPins: () => void;
  drawingTerritory: boolean;
  onToggleDrawTerritory: () => void;
  territoryListOpen: boolean;
  onToggleTerritoryList: () => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  drawingLasso: boolean;
  onToggleLasso: () => void;
}) {
  const satelliteActive = styleMode === "satellite";
  const StyleIcon = satelliteActive ? Satellite : MapIcon;

  const buttonBase =
    "flex h-10 w-10 items-center justify-center rounded-md transition-colors";
  const activeClasses = "bg-slate-900 text-white hover:bg-slate-800";
  const inactiveClasses =
    "text-zinc-300 hover:bg-black hover:text-white";

  return (
    <div className="absolute top-4 right-4 z-10 flex w-12 flex-col items-center gap-2 rounded-lg border border-[#1f1f24] bg-[#0f0f12] p-1 shadow-md">
      <button
        type="button"
        onClick={onToggleStyle}
        title="Toggle satellite view"
        aria-label="Toggle satellite view"
        className={
          buttonBase +
          " " +
          (satelliteActive ? activeClasses : inactiveClasses)
        }
      >
        <StyleIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onTogglePins}
        title="Show/hide pins"
        aria-label="Show/hide pins"
        aria-pressed={pinsVisible}
        className={
          buttonBase + " " + (pinsVisible ? activeClasses : inactiveClasses)
        }
      >
        <MapPin className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleCustomerPins}
        title="Show/hide customers"
        aria-label="Show/hide customers"
        aria-pressed={customerPinsVisible}
        className={
          buttonBase +
          " " +
          (customerPinsVisible ? activeClasses : inactiveClasses)
        }
      >
        <Users className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleDrawTerritory}
        title={drawingTerritory ? "Cancel drawing" : "Draw territory"}
        aria-label={drawingTerritory ? "Cancel drawing territory" : "Draw territory"}
        aria-pressed={drawingTerritory}
        className={
          buttonBase +
          " " +
          (drawingTerritory ? activeClasses : inactiveClasses)
        }
      >
        <Hexagon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleTerritoryList}
        title="Edit territory"
        aria-label="Edit territory"
        aria-pressed={territoryListOpen}
        className={
          buttonBase +
          " " +
          (territoryListOpen ? activeClasses : inactiveClasses)
        }
      >
        <Pencil className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleFilter}
        title="Filters"
        aria-label="Filters"
        aria-pressed={filterOpen}
        className={
          buttonBase + " " + (filterOpen ? activeClasses : inactiveClasses)
        }
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleLasso}
        title={drawingLasso ? "Cancel lasso" : "Lasso customers for text blast"}
        aria-label={
          drawingLasso ? "Cancel lasso" : "Lasso customers for text blast"
        }
        aria-pressed={drawingLasso}
        className={
          buttonBase +
          " " +
          (drawingLasso ? activeClasses : inactiveClasses)
        }
      >
        <Lasso className="h-5 w-5" />
      </button>
    </div>
  );
}
