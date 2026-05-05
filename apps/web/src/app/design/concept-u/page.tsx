import { RealDashboard, type Variant } from "../_realdash";

// Concept U — "Accented" — left-bar active nav, more blue presence
const v: Variant = {
  letter: "U",
  name: "Accented",
  cardLight: "bg-white border border-zinc-200",
  cardDark: "bg-zinc-900 border border-zinc-800",
  cardRadius: "rounded-2xl",
  cardShadowLight: "",
  cardShadowDark: "",
  sidebarLight: "bg-white border-r border-zinc-200",
  sidebarDark: "bg-zinc-950 border-r border-zinc-800",
  sidebarRadius: "",
  sidebarFloat: false,
  activeNavStyle: "leftbar",
  cardPadding: "p-5",
  cardHeaderPad: "px-5 pt-5 pb-3",
  sectionGap: "space-y-5",
};

export default function Page() {
  return <RealDashboard v={v} />;
}
