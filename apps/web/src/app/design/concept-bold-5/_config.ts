import type { BoldConfig } from "../_bold";

// B5 — "Airy Light"
// Most light, least black. Off-white canvas, white cards, smaller heading.
export const boldConfig: BoldConfig = {
  letter: "B5",
  name: "Airy Light",
  defaultDark: false,
  forceMode: "light",
  canvasBg: "bg-zinc-50",
  pageHeadingColor: "text-zinc-950",
  pageSubtitleColor: "text-zinc-500",
  navWeight: "font-bold",
  showSectionLabels: false,
  navActive: "leftbar",
  brandFontSize: "text-[15px]",
  headlineSize: "text-2xl sm:text-3xl",
  headlineWeight: "font-extrabold",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["5", "6", "7", "8"],
  navSlugPrefix: "concept-bold-",
};
