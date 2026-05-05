import type { Config } from "tailwindcss";

/**
 * Pulse design tokens are wired in via Tailwind theme extensions. The actual
 * values live in CSS variables defined in src/app/globals.css; this config
 * just gives them Tailwind class names. Both the TypeScript PULSE object
 * (components/pulse/theme.ts) and these classes resolve to the same vars,
 * so changing a value in globals.css propagates everywhere.
 *
 * Naming convention:
 *   bg-canvas / bg-card / bg-elevated     surfaces
 *   border-line / border-line-strong      borders
 *   text-fg / text-fg-muted / …            foreground text
 *   text-violet / text-green / …           accents
 *
 * See /DESIGN_SYSTEM.md for the full token reference.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "var(--color-canvas)",
        elevated: "var(--color-elevated)",
        card: "var(--color-card)",
        divider: "var(--color-divider)",
        line: "var(--color-line)",
        "line-strong": "var(--color-line-strong)",

        // Foreground (text)
        fg: "var(--color-fg)",
        "fg-muted": "var(--color-fg-muted)",
        "fg-subtle": "var(--color-fg-subtle)",
        "fg-dim": "var(--color-fg-dim)",

        // Accents (no scale — single role per name)
        violet: "var(--color-violet)",
        "violet-soft": "var(--color-violet-soft)",
        green: "var(--color-green)",
        red: "var(--color-red)",
        cyan: "var(--color-cyan)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      // Compound text tokens. Each entry sets size + lineHeight + letterSpacing
      // + fontWeight in one class. Use them as `text-h1`, `text-label`, etc.
      // Tailwind utility classes (e.g. font-black, uppercase) still compose.
      fontSize: {
        // Headings
        h1: ["40px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "800" }],
        "h1-hero": ["48px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "800" }],
        "h1-display": ["52px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "900" }],
        h2: ["15px", { lineHeight: "1.4", letterSpacing: "-0.025em", fontWeight: "800" }],
        h3: ["13.5px", { lineHeight: "1.4", fontWeight: "800" }],

        // Body
        subtitle: ["14px", { lineHeight: "1.5", fontWeight: "700" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "700" }],
        "body-sm": ["12px", { lineHeight: "1.5", fontWeight: "700" }],

        // KPI / metric values
        "kpi-value": ["26px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "900" }],
        "kpi-value-lg": ["44px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "900" }],

        // Uppercase labels (size + tracking + weight)
        "label-page": ["11px", { lineHeight: "1", letterSpacing: "0.22em", fontWeight: "800" }],
        label: ["11px", { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "800" }],
        "label-table": ["11px", { lineHeight: "1", letterSpacing: "0.16em", fontWeight: "800" }],

        // Micro caps (LiveBadge, AM/PM, activity time)
        micro: ["10px", { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "700" }],
      },
      borderRadius: {
        card: "1rem", // alias for the canonical card radius (was rounded-2xl)
        pill: "9999px",
      },
      boxShadow: {
        "glow-violet": "var(--shadow-glow-violet)",
        "glow-violet-sm": "var(--shadow-glow-violet-sm)",
        "glow-green": "var(--shadow-glow-green)",
        menu: "var(--shadow-menu)",
        tooltip: "var(--shadow-tooltip)",
      },
      width: {
        sidebar: "var(--layout-sidebar-width)",
      },
      spacing: {
        sidebar: "var(--layout-sidebar-width)",
      },
      maxWidth: {
        app: "var(--layout-app-max-width)",
      },
    },
  },
  plugins: [],
} satisfies Config;
