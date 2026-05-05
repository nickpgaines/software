/**
 * Pulse design tokens — TypeScript bindings.
 *
 * Values mirror the CSS variables in src/app/globals.css. They are kept as
 * hex literals here (rather than `var(--…)` strings) because existing inline
 * style code does opacity concatenation like `${PULSE.green}1F`, which only
 * works on hex.
 *
 * If you change a value here, ALSO change it in globals.css and the
 * Tailwind theme extension in tailwind.config.ts. This duplication is a
 * known cost of supporting both inline-style hex concatenation AND CSS
 * variables; the migration plan in /DESIGN_SYSTEM.md describes how
 * inline-style usage will be moved to Tailwind classes (`bg-green/10`,
 * etc.) so that this file can eventually become a thin re-export of the
 * CSS variables.
 *
 * Token names mirror CSS variable names so grepping for either side maps
 * cleanly:
 *   PULSE.card        ↔ --color-card        ↔ Tailwind `bg-card`
 *   PULSE.textMuted   ↔ --color-fg-muted    ↔ Tailwind `text-fg-muted`
 *
 * See /DESIGN_SYSTEM.md for the canonical role of each token.
 */

export const PULSE = {
  // Surfaces
  bg: "#000000",
  bgAlt: "#0a0a0a",
  card: "#0f0f12",
  divider: "#18181b",
  cardBorder: "#1f1f24",
  cardBorderHi: "#2a2a32",

  // Foreground (text)
  text: "#ffffff",
  textMuted: "#a1a1aa",
  textSubtle: "#71717a",
  textDim: "#52525b",

  // Accents
  violet: "#8b5cf6",
  violetSoft: "#a78bfa",
  violetGlow: "rgba(139, 92, 246, 0.35)",
  green: "#22c55e",
  greenSoft: "#4ade80",
  red: "#ef4444",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  pink: "#ec4899",
  pinkSoft: "#f472b6",
};
