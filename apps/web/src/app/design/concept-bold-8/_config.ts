import type { BoldConfig } from "../_bold";

// B8 — "Inverted Mix"
// Light grey canvas with dark widgets — page heading stays dark on canvas,
// cards lift off in black with white text. Headline mid-size.
export const boldConfig: BoldConfig = {
  letter: "B8",
  name: "Inverted Mix",
  defaultDark: false,
  forceMode: "dark", // dark cards
  canvasBg: "bg-zinc-100", // but light canvas
  pageHeadingColor: "text-zinc-950", // dark heading on light canvas
  pageSubtitleColor: "text-zinc-500",
  navWeight: "font-extrabold",
  showSectionLabels: false,
  navActive: "fill",
  brandFontSize: "text-[15px]",
  headlineSize: "text-3xl sm:text-4xl",
  headlineWeight: "font-extrabold",
  showKpiStrip: false,
  kpiValueSize: "text-[40px]",
  kpiValueWeight: "font-extrabold",
  scheduleScale: "default",
  navLetters: ["5", "6", "7", "8"],
  navSlugPrefix: "concept-bold-",
};
