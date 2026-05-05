import { RealDashboard2, type Variant2 } from "../_realdash2";

// Y — Editorial. Bigger headline, no card borders, outlined status pills.
const v: Variant2 = {
  letter: "Y",
  name: "Editorial",
  cardLight: "bg-white",
  cardDark: "bg-zinc-900",
  cardRadius: "rounded-2xl",
  cardShadowLight: "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  cardShadowDark: "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
  sidebarLight: "bg-white",
  sidebarDark: "bg-zinc-950",
  headingSize: "text-4xl sm:text-5xl",
  bodyWeight: "font-semibold",
  pillRadius: "rounded-full",
  statusPillStyle: "outlined",
  activeNavStyle: "fill",
  sectionGap: "space-y-7",
  cardHeaderAccent: false,
};

export default function Page() {
  return <RealDashboard2 v={v} />;
}
