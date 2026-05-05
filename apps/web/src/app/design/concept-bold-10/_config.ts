import type { BoldConfig } from "../_bold";

// B10 — B5↔B7 palette toggle · headline text-5xl→text-[56px] (between B6 and B7)
export const boldConfig: BoldConfig = {
  letter: "B10",
  name: "Toggle · 56px",
  defaultDark: false,
  canvasBgLight: "bg-zinc-50",
  canvasBgDark: "bg-zinc-900",
  navWeight: "font-bold",
  showSectionLabels: false,
  navActive: "leftbar",
  brandFontSize: "text-[15px]",
  headlineSize: "text-5xl sm:text-[56px]",
  headlineWeight: "font-extrabold",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["9", "10", "11", "12"],
  navSlugPrefix: "concept-bold-",
};
