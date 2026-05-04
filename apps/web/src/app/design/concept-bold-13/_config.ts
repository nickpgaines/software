import type { BoldConfig } from "../_bold";

// B13 — Pop-up sidebar · leftbar active state
export const boldConfig: BoldConfig = {
  letter: "B13",
  name: "Pop-up · leftbar",
  defaultDark: false,
  canvasBgLight: "bg-zinc-50",
  canvasBgDark: "bg-zinc-900",
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
  navLetters: ["13", "14", "15", "16"],
  navSlugPrefix: "concept-bold-",
  sidebarMode: "floating",
  navSize: "large",
  // Tinted pill variant: New button is black (matches text color); active
  // nav state stays blue-tinted.
  newButtonAccent: "#0a0a0a",
};
