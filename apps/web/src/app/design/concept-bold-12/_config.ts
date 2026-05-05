import type { BoldConfig } from "../_bold";

// B12 — B5↔B7 palette toggle · headline text-6xl→text-7xl (bigger than B7)
export const boldConfig: BoldConfig = {
  letter: "B12",
  name: "Toggle · 7xl",
  defaultDark: false,
  canvasBgLight: "bg-zinc-50",
  canvasBgDark: "bg-zinc-900",
  navWeight: "font-bold",
  showSectionLabels: false,
  navActive: "leftbar",
  brandFontSize: "text-[15px]",
  headlineSize: "text-6xl sm:text-7xl",
  headlineWeight: "font-black",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["9", "10", "11", "12"],
  navSlugPrefix: "concept-bold-",
};
