import type { BoldConfig } from "../_bold";

// B15 — Static sidebar · leftbar active state
export const boldConfig: BoldConfig = {
  letter: "B15",
  name: "Static · leftbar",
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
  sidebarMode: "static",
  navSize: "large",
  // Tinted pill variant where BOTH the New button and the tinted active
  // state go black.
  newButtonAccent: "#0a0a0a",
  navActiveAccent: "#0a0a0a",
};
