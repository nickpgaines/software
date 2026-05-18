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
        sidebar: "var(--color-sidebar)",
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

        // ----------------------------------------------------------------
        // shadcn bridge color aliases.
        //
        // shadcn/ui-generated primitives (under components/ui/) reference
        // a fixed set of Tailwind class names — bg-primary, bg-secondary,
        // bg-muted, bg-accent, bg-destructive, bg-popover, border-input,
        // ring — that don't map to our Pulse token names. The CSS-side
        // bridge in globals.css already aliases the matching CSS variables
        // (--primary, --secondary, …) onto our Pulse tokens (--color-violet,
        // --color-elevated, …); these Tailwind entries expose the same
        // bridge names as utility classes so shadcn templates resolve.
        //
        // These are duplicate aliases on top of the canonical canvas/card/
        // fg/line tokens above — change a Pulse token in globals.css and
        // both sides update. Do not introduce new bridge entries unless a
        // shadcn primitive in components/ui/ references the class name.
        //
        // shadcn's CLI auto-wraps these as hsl(var(--background)). Our
        // tokens are full color values (hex/rgba), not HSL channels, so
        // the wrapper is intentionally omitted — entries reference
        // var(--*) directly. See globals.css §"shadcn/ui bridge variables".
        // ----------------------------------------------------------------
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      fontSize: {
        // Page-level H1 used on standard app pages (Customers, Employees,
        // Settings, Reports, Leads, login/signup, modals, etc.). Distinct
        // from the Pulse hero greeting (`text-[48px]`) and chart headline
        // (`text-[52px]`) — those stay as-is. Bakes in the four properties
        // that always travel together: 40px / extrabold / tracking-tight /
        // leading-none. Pair with `text-white` and (for numerics) `tabular-nums`.
        "page-title": [
          "40px",
          { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "800" },
        ],
        // Widget-internal uppercase label — KPI labels, form labels, table
        // column headers, status indicators. Encodes the §4 "0.18em tier" of
        // the uppercase tracking scale: 11px / extrabold / tracking 0.18em.
        // Apply alongside `uppercase` and a color utility (`text-fg-subtle`
        // / `text-zinc-500`).
        eyebrow: [
          "11px",
          { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "800" },
        ],
        // Tighter eyebrow variant for table column headers — same scale and
        // weight as `text-eyebrow`, but with 0.16em tracking (the §4 "0.16em
        // micro-caps" tier). Reserved for tightly packed grid contexts where
        // 0.18em would feel too airy.
        "eyebrow-tight": [
          "11px",
          { lineHeight: "1", letterSpacing: "0.16em", fontWeight: "800" },
        ],
      },
      borderRadius: {
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
        // Mobile safe-area bottom inset. See globals.css for the value and
        // DESIGN_SYSTEM.md §5 for the policy. Use with `pb-safe-b` to give
        // bottom-stuck UI (message input, modal action bars, fixed docks)
        // breathing room above the iOS home indicator.
        "safe-b": "var(--safe-bottom)",
      },
      maxWidth: {
        app: "var(--layout-app-max-width)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
