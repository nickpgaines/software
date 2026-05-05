import type { BoldConfig } from "../_bold";

// B6 — "Layered Grey"
// More visible grey canvas, white cards pop harder, mid-size heading.
export const boldConfig: BoldConfig = {
  letter: "B6",
  name: "Layered Grey",
  defaultDark: false,
  forceMode: "light",
  canvasBg: "bg-zinc-200",
  pageHeadingColor: "text-zinc-950",
  pageSubtitleColor: "text-zinc-600",
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
  navLetters: ["5", "6", "7", "8"],
  navSlugPrefix: "concept-bold-",
};
