import { ThemedDashboard, type Palette } from "../_themed";

// Concept M — Light grey background
const palette: Palette = {
  letter: "M",
  name: "Light",
  bg: "bg-zinc-100",
  sidebar: "bg-white",
  sidebarBorder: "border-r border-zinc-200",
  card: "bg-white",
  cardBorder: "border border-zinc-200",
  divider: "border-zinc-200",
  text: "text-zinc-900",
  textMuted: "text-zinc-500",
  textSubtle: "text-zinc-400",
  searchBg: "bg-white",
  searchBorder: "border border-zinc-200 hover:border-zinc-300",
  hoverBg: "hover:bg-zinc-100",
  pillNeutralBg: "bg-zinc-100",
  pillNeutralText: "text-zinc-600",
  trackBg: "bg-zinc-100",
  segmentBg: "bg-zinc-100",
  segmentActiveBg: "bg-white",
  brandTextOnSidebar: "text-zinc-950",
  isDark: false,
};

export default function ConceptMPage() {
  return <ThemedDashboard p={palette} />;
}
