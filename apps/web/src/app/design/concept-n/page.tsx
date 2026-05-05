import { ThemedDashboard, type Palette } from "../_themed";

// Concept N — Mid grey background (more obviously grey)
const palette: Palette = {
  letter: "N",
  name: "Mid",
  bg: "bg-zinc-300",
  sidebar: "bg-white",
  sidebarBorder: "border-r border-zinc-300",
  card: "bg-white",
  cardBorder: "border border-zinc-300/70",
  divider: "border-zinc-200",
  text: "text-zinc-900",
  textMuted: "text-zinc-500",
  textSubtle: "text-zinc-400",
  searchBg: "bg-white",
  searchBorder: "border border-zinc-300/70 hover:border-zinc-400",
  hoverBg: "hover:bg-zinc-100",
  pillNeutralBg: "bg-zinc-100",
  pillNeutralText: "text-zinc-600",
  trackBg: "bg-zinc-100",
  segmentBg: "bg-zinc-100",
  segmentActiveBg: "bg-white",
  brandTextOnSidebar: "text-zinc-950",
  isDark: false,
};

export default function ConceptNPage() {
  return <ThemedDashboard p={palette} />;
}
