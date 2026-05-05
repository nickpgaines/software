import { RealDashboard, type Variant } from "../_realdash";

// Concept Q — "Crisp" base
const v: Variant = {
  letter: "Q",
  name: "Crisp",
  cardLight: "bg-white border border-zinc-200",
  cardDark: "bg-zinc-900 border border-zinc-800",
  cardRadius: "rounded-2xl",
  cardShadowLight: "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  cardShadowDark: "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
  sidebarLight: "bg-white border-r border-zinc-200",
  sidebarDark: "bg-zinc-950 border-r border-zinc-800",
  sidebarRadius: "",
  sidebarFloat: false,
  activeNavStyle: "fill",
  cardPadding: "p-5",
  cardHeaderPad: "px-5 pt-5 pb-3",
  sectionGap: "space-y-5",
};

export default function Page() {
  return <RealDashboard v={v} />;
}
