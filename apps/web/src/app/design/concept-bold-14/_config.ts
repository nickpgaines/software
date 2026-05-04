import type { BoldConfig } from "../_bold";

// B14 — Pop-up sidebar · solid fill active state
export const boldConfig: BoldConfig = {
  letter: "B14",
  name: "Pop-up · fill",
  defaultDark: false,
  canvasBgLight: "bg-zinc-50",
  canvasBgDark: "bg-zinc-900",
  navWeight: "font-bold",
  showSectionLabels: false,
  navActive: "fill",
  brandFontSize: "text-[15px]",
  headlineSize: "text-4xl sm:text-5xl",
  headlineWeight: "font-extrabold",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["13", "14", "15", "16"],
  navSlugPrefix: "concept-bold-",
  sidebarMode: "floating",
  navSize: "large",
};
