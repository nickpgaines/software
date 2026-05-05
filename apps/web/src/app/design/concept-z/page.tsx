import { RealDashboard2, type Variant2 } from "../_realdash2";

// Z — Tinted. Active nav uses left-bar tint, card titles get a small accent line.
const v: Variant2 = {
  letter: "Z",
  name: "Tinted",
  cardLight: "bg-white border border-zinc-200",
  cardDark: "bg-zinc-900 border border-zinc-800",
  cardRadius: "rounded-2xl",
  cardShadowLight: "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  cardShadowDark: "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
  sidebarLight: "bg-white",
  sidebarDark: "bg-zinc-950",
  headingSize: "text-3xl sm:text-4xl",
  bodyWeight: "font-semibold",
  pillRadius: "rounded-full",
  statusPillStyle: "filled",
  activeNavStyle: "leftbar",
  sectionGap: "space-y-6",
  cardHeaderAccent: true,
};

export default function Page() {
  return <RealDashboard2 v={v} />;
}
