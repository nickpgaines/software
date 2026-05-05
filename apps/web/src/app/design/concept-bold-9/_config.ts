import type { BoldConfig } from "../_bold";

// B9 — B5↔B7 palette toggle · headline text-4xl→text-5xl (B6 baseline)
export const boldConfig: BoldConfig = {
  letter: "B9",
  name: "Toggle · 5xl",
  defaultDark: false,
  // No forceMode — toggle is enabled
  canvasBgLight: "bg-zinc-50",
  canvasBgDark: "bg-zinc-900",
  // No pageHeading colors — auto-flip with mode
  navWeight: "font-bold",
  showSectionLabels: false,
  navActive: "leftbar",
  brandFontSize: "text-[15px]",
  headlineSize: "text-4xl sm:text-5xl",
  headlineWeight: "font-extrabold",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["9", "10", "11", "12"],
  navSlugPrefix: "concept-bold-",
};
