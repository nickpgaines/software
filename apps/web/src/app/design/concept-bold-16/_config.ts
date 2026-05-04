import type { BoldConfig } from "../_bold";

// B16 — Static sidebar · solid fill active state
export const boldConfig: BoldConfig = {
  letter: "B16",
  name: "Static · fill",
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
  sidebarMode: "static",
  navSize: "large",
  // Solid variant: New button and active fill both go black.
  newButtonAccent: "#0a0a0a",
  navActiveAccent: "#0a0a0a",
};
