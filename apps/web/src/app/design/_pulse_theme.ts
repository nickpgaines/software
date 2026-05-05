// Shared design tokens for the Pulse-inspired dark variants.
// Pure black canvas, violet primary accent (matching Kyle's Pulse),
// secondary neons for the "dopamine" variant.

export const PULSE = {
  // Surfaces
  bg: "#000000",
  bgAlt: "#0a0a0a",
  card: "#0f0f12",
  cardBorder: "#1f1f24",
  cardBorderHi: "#2a2a32",
  divider: "#18181b",

  // Text
  text: "#ffffff",
  textMuted: "#a1a1aa",
  textSubtle: "#71717a",
  textDim: "#52525b",

  // Accents
  violet: "#8b5cf6", // primary
  violetSoft: "#a78bfa",
  violetGlow: "rgba(139, 92, 246, 0.35)",
  green: "#22c55e",
  greenSoft: "#4ade80",
  pink: "#ec4899",
  pinkSoft: "#f472b6",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  red: "#ef4444",
};

export const PULSE_NAV: { name: string; icon: string; href: string | null; section?: string }[] = [
  { name: "Dashboard", icon: "home", href: "/design/__SLUG__" },
  { name: "Schedule", icon: "calendar", href: null },
  { name: "Map", icon: "map", href: null },
  { name: "Leads", icon: "inbox", href: null, section: "Pipeline" },
  { name: "Estimates", icon: "doc", href: null, section: "Pipeline" },
  { name: "Jobs", icon: "check", href: null, section: "Pipeline" },
  { name: "Invoices", icon: "wallet", href: null, section: "Pipeline" },
  { name: "Messages", icon: "message", href: null, section: "Inbox" },
  { name: "Calls", icon: "phone", href: null, section: "Inbox" },
  { name: "Email", icon: "mail", href: null, section: "Inbox" },
  { name: "Reports", icon: "chart", href: null, section: "Insights" },
  { name: "Leaderboard", icon: "trophy", href: null, section: "Insights" },
  { name: "Customers", icon: "user", href: null, section: "Team" },
  { name: "Employees", icon: "users", href: null, section: "Team" },
  { name: "Settings", icon: "settings", href: null, section: "Team" },
];
