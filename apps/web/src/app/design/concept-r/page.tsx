import { RealDashboard, type Variant } from "../_realdash";

// Concept R — "Floating" — sidebar floats with margin, cards have shadow not border
const v: Variant = {
  letter: "R",
  name: "Floating",
  cardLight: "bg-white",
  cardDark: "bg-zinc-900",
  cardRadius: "rounded-2xl",
  cardShadowLight: "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.08)]",
  cardShadowDark: "shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_-8px_rgba(0,0,0,0.5)]",
  sidebarLight: "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.08)]",
  sidebarDark: "bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_-8px_rgba(0,0,0,0.5)]",
  sidebarRadius: "rounded-2xl",
  sidebarFloat: true,
  activeNavStyle: "fill",
  cardPadding: "p-5",
  cardHeaderPad: "px-5 pt-5 pb-3",
  sectionGap: "space-y-5",
};

export default function Page() {
  return <RealDashboard v={v} />;
}
