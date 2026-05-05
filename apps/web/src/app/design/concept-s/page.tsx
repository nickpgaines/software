import { RealDashboard, type Variant } from "../_realdash";

// Concept S — "Sharp" — tighter rounded-lg corners, strong borders, no shadow
const v: Variant = {
  letter: "S",
  name: "Sharp",
  cardLight: "bg-white border border-zinc-300/80",
  cardDark: "bg-zinc-900 border border-zinc-700/80",
  cardRadius: "rounded-lg",
  cardShadowLight: "",
  cardShadowDark: "",
  sidebarLight: "bg-white border-r border-zinc-300/80",
  sidebarDark: "bg-zinc-950 border-r border-zinc-700/80",
  sidebarRadius: "",
  sidebarFloat: false,
  activeNavStyle: "fill",
  cardPadding: "p-5",
  cardHeaderPad: "px-5 pt-5 pb-3",
  sectionGap: "space-y-4",
};

export default function Page() {
  return <RealDashboard v={v} />;
}
