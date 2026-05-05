import { RealDashboard2, type Variant2 } from "../_realdash2";

// V — Default. Base after the three fixes.
const v: Variant2 = {
  letter: "V",
  name: "Default",
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
  activeNavStyle: "fill",
  sectionGap: "space-y-6",
  cardHeaderAccent: false,
};

export default function Page() {
  return <RealDashboard2 v={v} />;
}
