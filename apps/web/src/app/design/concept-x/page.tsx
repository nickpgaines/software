import { RealDashboard2, type Variant2 } from "../_realdash2";

// X — Crisp. Stronger borders, no shadow, sharper corners, lighter body weight.
const v: Variant2 = {
  letter: "X",
  name: "Crisp",
  cardLight: "bg-white border border-zinc-300/80",
  cardDark: "bg-zinc-900 border border-zinc-700/80",
  cardRadius: "rounded-xl",
  cardShadowLight: "",
  cardShadowDark: "",
  sidebarLight: "bg-white",
  sidebarDark: "bg-zinc-950",
  headingSize: "text-3xl",
  bodyWeight: "font-medium",
  pillRadius: "rounded-md",
  statusPillStyle: "filled",
  activeNavStyle: "fill",
  sectionGap: "space-y-5",
  cardHeaderAccent: false,
};

export default function Page() {
  return <RealDashboard2 v={v} />;
}
