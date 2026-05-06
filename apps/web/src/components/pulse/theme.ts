/**
 * Pulse design tokens — TypeScript bindings.
 *
 * Surface and text tokens are CSS-variable references (`var(--color-*)`) so
 * inline styles using them automatically respond to the active theme
 * (dark by default; `html[data-theme="light"]` flips them — see
 * src/app/globals.css). Accent tokens stay as hex literals because some
 * call sites concatenate opacity onto them (`${PULSE.green}1F`), which
 * only works on hex.
 *
 * Token names mirror CSS variable names so grepping for either side maps
 * cleanly:
 *   PULSE.card        ↔ --color-card        ↔ Tailwind `bg-card`
 *   PULSE.textMuted   ↔ --color-fg-muted    ↔ Tailwind `text-fg-muted`
 *
 * See /DESIGN_SYSTEM.md for the canonical role of each token.
 */

export const PULSE = {
  // Surfaces — CSS-var refs so they flip with the active theme.
  bg: "var(--color-canvas)",
  bgAlt: "var(--color-elevated)",
  card: "var(--color-card)",
  divider: "var(--color-divider)",
  cardBorder: "var(--color-line)",
  cardBorderHi: "var(--color-line-strong)",

  // Foreground (text) — same.
  text: "var(--color-fg)",
  textMuted: "var(--color-fg-muted)",
  textSubtle: "var(--color-fg-subtle)",
  textDim: "var(--color-fg-dim)",

  // Accents — hex literals because opacity concatenation (`${…}1F`) is used.
  violet: "#8b5cf6",
  violetSoft: "#a78bfa",
  violetGlow: "rgba(139, 92, 246, 0.35)",
  green: "#22c55e",
  red: "#ef4444",
  cyan: "#22d3ee",
};
