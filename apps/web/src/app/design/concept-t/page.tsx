import { RealDashboard, type Variant } from "../_realdash";

// Concept T — "Spacious" — bigger rounded-3xl corners, no border, more padding
const v: Variant = {
  letter: "T",
  name: "Spacious",
  cardLight: "bg-white",
  cardDark: "bg-zinc-900",
  cardRadius: "rounded-3xl",
  cardShadowLight: "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  cardShadowDark: "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
  sidebarLight: "bg-white",
  sidebarDark: "bg-zinc-950",
  sidebarRadius: "",
  sidebarFloat: false,
  activeNavStyle: "fill",
  cardPadding: "p-7",
  cardHeaderPad: "px-7 pt-7 pb-4",
  sectionGap: "space-y-6",
};

export default function Page() {
  return <RealDashboard v={v} />;
}
