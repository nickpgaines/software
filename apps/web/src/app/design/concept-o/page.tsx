import { ThemedDashboard, type Palette } from "../_themed";

// Concept O — Dark grey background (neutral dark)
const palette: Palette = {
  letter: "O",
  name: "Dark",
  bg: "bg-zinc-800",
  sidebar: "bg-zinc-900",
  sidebarBorder: "border-r border-zinc-800",
  card: "bg-zinc-700/60",
  cardBorder: "border border-zinc-600/40",
  divider: "border-zinc-600/40",
  text: "text-zinc-100",
  textMuted: "text-zinc-400",
  textSubtle: "text-zinc-500",
  searchBg: "bg-zinc-900",
  searchBorder: "border border-zinc-700/60 hover:border-zinc-600",
  hoverBg: "hover:bg-zinc-800/50",
  pillNeutralBg: "bg-zinc-800",
  pillNeutralText: "text-zinc-300",
  trackBg: "bg-zinc-800",
  segmentBg: "bg-zinc-800/80",
  segmentActiveBg: "bg-zinc-600",
  brandTextOnSidebar: "text-white",
  isDark: true,
};

export default function ConceptOPage() {
  return <ThemedDashboard p={palette} />;
}
