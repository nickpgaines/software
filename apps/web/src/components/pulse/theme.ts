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
  sidebar: "var(--color-sidebar)",
  divider: "var(--color-divider)",
  cardBorder: "var(--color-line)",
  cardBorderHi: "var(--color-line-strong)",

  // Foreground (text) — same.
  text: "var(--color-fg)",
  textMuted: "var(--color-fg-muted)",
  textSubtle: "var(--color-fg-subtle)",
  textDim: "var(--color-fg-dim)",

  // Accents — hex literals because opacity concatenation (`${…}1F`) is used.
  violet: "#ffffff",
  violetSoft: "#e4e4e7",
  violetGlow: "rgba(255, 255, 255, 0.18)",
  green: "#22c55e",
  red: "#ef4444",
  cyan: "#22d3ee",

  // CSS-variable bindings for the violet accent. Resolve to the same hex
  // values in production, but can be overridden inside a wrapper that sets
  // `--color-violet` / `--color-violet-soft` (e.g. the dashboard theme
  // preview routes under /design/theme-options). Use these at call sites
  // that paint a standalone background/color — keep the hex strings above
  // for sites that need opacity concatenation (`${PULSE.violet}1F`).
  violetVar: "var(--color-violet)",
  violetSoftVar: "var(--color-violet-soft)",
};
