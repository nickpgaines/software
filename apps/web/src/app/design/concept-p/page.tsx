import { ThemedDashboard, type Palette } from "../_themed";

// Concept P — Cool dark grey (slate, slight blue tint to harmonize with the blue accent)
const palette: Palette = {
  letter: "P",
  name: "Cool Dark",
  bg: "bg-slate-800",
  sidebar: "bg-slate-900",
  sidebarBorder: "border-r border-slate-800",
  card: "bg-slate-700/60",
  cardBorder: "border border-slate-600/40",
  divider: "border-slate-600/40",
  text: "text-slate-100",
  textMuted: "text-slate-400",
  textSubtle: "text-slate-500",
  searchBg: "bg-slate-900",
  searchBorder: "border border-slate-700/60 hover:border-slate-600",
  hoverBg: "hover:bg-slate-800/50",
  pillNeutralBg: "bg-slate-800",
  pillNeutralText: "text-slate-300",
  trackBg: "bg-slate-800",
  segmentBg: "bg-slate-800/80",
  segmentActiveBg: "bg-slate-600",
  brandTextOnSidebar: "text-white",
  isDark: true,
};

export default function ConceptPPage() {
  return <ThemedDashboard p={palette} />;
}
