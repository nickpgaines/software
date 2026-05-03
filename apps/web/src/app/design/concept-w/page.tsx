import { RealDashboard2, type Variant2 } from "../_realdash2";

// W — Soft. Borderless cards, gentle shadow, more rounded.
const v: Variant2 = {
  letter: "W",
  name: "Soft",
  cardLight: "bg-white",
  cardDark: "bg-zinc-900",
  cardRadius: "rounded-3xl",
  cardShadowLight: "shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_24px_-12px_rgba(0,0,0,0.10)]",
  cardShadowDark: "shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]",
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
