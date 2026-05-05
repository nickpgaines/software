import type { BoldConfig } from "../_bold";

// B7 — "All Black"
// Most black. Dark canvas, dark cards, white text, huge headline.
export const boldConfig: BoldConfig = {
  letter: "B7",
  name: "All Black",
  defaultDark: true,
  forceMode: "dark",
  canvasBg: "bg-zinc-900",
  pageHeadingColor: "text-white",
  pageSubtitleColor: "text-zinc-400",
  navWeight: "font-extrabold",
  showSectionLabels: true,
  navActive: "fill",
  brandFontSize: "text-[16px]",
  headlineSize: "text-5xl sm:text-6xl",
  headlineWeight: "font-black",
  showKpiStrip: false,
  kpiValueSize: "text-[36px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["5", "6", "7", "8"],
  navSlugPrefix: "concept-bold-",
};
