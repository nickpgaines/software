import type { BoldConfig } from "../_bold";

// B11 — B5↔B7 palette toggle · headline text-5xl→text-6xl (B7 baseline)
export const boldConfig: BoldConfig = {
  letter: "B11",
  name: "Toggle · 6xl",
  defaultDark: false,
  canvasBgLight: "bg-zinc-50",
  canvasBgDark: "bg-zinc-900",
  navWeight: "font-bold",
  showSectionLabels: false,
  navActive: "leftbar",
  brandFontSize: "text-[15px]",
  headlineSize: "text-5xl sm:text-6xl",
  headlineWeight: "font-extrabold",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["9", "10", "11", "12"],
  navSlugPrefix: "concept-bold-",
};
