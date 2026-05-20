# Forge CRM — DESIGN_SYSTEM

> **What this is.** A factual record of the visual language in use on
> the Forge CRM dashboard, plus the canonical rules that govern it.
> Every value reflects shipping code; nothing here is aspirational.
>
> **Source of truth rule.** When the code and this doc disagree, this
> doc is wrong — file an update. When two parts of the code disagree,
> §10 names the canonical version and links to the commit that resolved
> the drift; new work follows the canonical version.
>
> **Drift policy.** If you discover a new inconsistency, either bring
> the call site into line with the canonical rules in §3–§9 or open a
> PR that adds a row to §10's resolutions table alongside the call-site
> change. Don't leave silent drift.

---

## 1. Source files surveyed

This document was produced by reading the dashboard page and every
component it transitively imports.

```
apps/web/src/app/layout.tsx                       # root <html><body>
apps/web/src/app/globals.css                      # global CSS
apps/web/src/app/(app)/layout.tsx                 # app group layout
apps/web/src/app/(app)/page.tsx                   # dashboard
apps/web/src/lib/dashboard.ts                     # server data fetchers
apps/web/src/components/PhoneClient.tsx           # voice provider (wraps layout)
apps/web/src/components/pulse/theme.ts            # color tokens
apps/web/src/components/pulse/format.ts           # formatters
apps/web/src/components/pulse/types.ts            # shared types
apps/web/src/components/pulse/Icon.tsx            # PulseIcon
apps/web/src/components/pulse/Sidebar.tsx         # PulseSidebar
apps/web/src/components/pulse/widgets.tsx         # every other primitive
apps/web/tailwind.config.ts                       # Tailwind config
```

---

## 2. Font family

**Inter is the canonical sans face.** Loaded via `next/font/google` and
self-hosted by Next (no Google Fonts CDN request).

- `apps/web/src/app/layout.tsx` imports `Inter` from `next/font/google`
  with `subsets: ["latin"]`, `display: "swap"`, and
  `variable: "--font-sans"`. `inter.variable` is applied to the `<html>`
  element so the CSS variable cascades app-wide.
- `apps/web/src/app/globals.css` declares a fallback `--font-sans` on
  `:root` (covers SSR before the variable class lands) and sets
  `body { font-family: var(--font-sans) }`.
- `apps/web/tailwind.config.ts` extends `theme.fontFamily.sans` to
  `["var(--font-sans)"]`, so the Tailwind `font-sans` utility also
  resolves to Inter.

**Effective stack** at runtime:
`"Inter", <metric-adjusted Arial fallback>, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`.

`next/font` generates an `ascent-override` / `descent-override` /
`size-adjust` Arial fallback so the swap from system Arial to loaded
Inter produces no measurable layout shift (CLS-free).

`font-mono` is allowed only for **literal code-shaped tokens** —
API keys, IDs, credentials being copy-pasted. Never for prose, labels,
or numbers. There are no `font-mono` usages on the Pulse surfaces
themselves; the only Pulse-adjacent occurrence is
`app/login/page.tsx:147` for the dev-mode `admin / admin` hint.

`font-serif` is not used anywhere.

---

## 3. Color tokens

All tokens are defined in `apps/web/src/components/pulse/theme.ts:25-47`
on the exported `PULSE` constant.

### Surfaces

| Token            | Hex         | Tailwind equivalent | Defined at | First use on dashboard                                      |
| ---------------- | ----------- | ------------------- | ---------- | ----------------------------------------------------------- |
| `PULSE.bg`       | `#000000`   | `bg-black`          | theme.ts:8 | `(app)/layout.tsx:10` body bg via inline style              |
| `PULSE.bgAlt`    | `#0a0a0a`   | `bg-[#0a0a0a]`      | theme.ts:9 | `widgets.tsx:68` (header search button); `widgets.tsx:438` (range pill track); `widgets.tsx:484` (schedule row bg) |
| `PULSE.card`     | `#0f0f12`   | `bg-[#0f0f12]`      | theme.ts:10 | `widgets.tsx:97` (CompactHeroKpi); `widgets.tsx:420` (chart card); every `<section>` widget |
| `PULSE.sidebar`  | `#000000`   | `bg-sidebar`        | theme.ts    | `Sidebar.tsx:110` (sidebar surface — dark: matches `bg`; light: white like cards) |
| `PULSE.cardBorder` | `#1f1f24` | `border-[#1f1f24]`  | theme.ts:11 | `widgets.tsx:97` (every default card border)                |
| `PULSE.cardBorderHi` | `#2a2a32` | `border-[#2a2a32]` | theme.ts:12 | `widgets.tsx:189` (sidebar profile chip); `widgets.tsx:342` (chart tooltip border); login/signup input borders |
| `PULSE.divider`  | `#18181b`   | `bg-[#18181b]`      | theme.ts:13 | `Sidebar.tsx:107` (sidebar right border); `Sidebar.tsx:185` (sidebar top divider)            |

#### Light theme surface mapping

Light mode (`html[data-theme="light"]`, defined in `globals.css:59-77`)
overrides the surface tokens so widgets and the sidebar render as white
on a light-gray page. The text tokens are unchanged from the dark
defaults' light-mode overrides — only surfaces:

| Token             | Dark value | Light value                  | Role in light mode                                       |
| ----------------- | ---------- | ---------------------------- | -------------------------------------------------------- |
| `--color-canvas`  | `#000000`  | `#f9f9fb`                    | Page background — subtle gray showing behind widgets     |
| `--color-elevated`| `#0a0a0a`  | `#ebebef`                    | Secondary surfaces (search button, range pill track)     |
| `--color-card`    | `#0f0f12`  | `#ffffff`                    | Widget surface — white                                   |
| `--color-sidebar` | `var(--color-canvas)` | `var(--color-card)` | Sidebar surface — matches canvas in dark, decoupled to white in light so it reads as a separate panel from the gray page bg |
| `--color-divider` | `#18181b`  | `#e4e4e7` (zinc-200)         | Sidebar dividers                                         |
| `--color-line`    | `#1f1f24`  | `#e4e4e7` (zinc-200)         | Default borders                                          |
| `--color-line-strong` | `#2a2a32` | `#d4d4d8` (zinc-300)      | Input borders, profile chip                              |

The `--color-sidebar` token exists so the sidebar can be visually
distinct from the page canvas in light mode without changing dark
mode (where both should remain pure black). In dark mode it aliases
`--color-canvas`; in light mode it aliases `--color-card`. The sidebar
is the only consumer — `Sidebar.tsx:110` via `PULSE.sidebar`.

### Text

| Token              | Hex         | Tailwind            | Defined at  | First use                                              |
| ------------------ | ----------- | ------------------- | ----------- | ------------------------------------------------------ |
| `PULSE.text`       | `#ffffff`   | `text-white`        | theme.ts:16 | `(app)/layout.tsx:10` body text; every heading         |
| `PULSE.textMuted`  | `#a1a1aa`   | `text-zinc-400`     | theme.ts:17 | `widgets.tsx:60` (subtitle under H1)                   |
| `PULSE.textSubtle` | `#71717a`   | `text-zinc-500`     | theme.ts:18 | `widgets.tsx:69` (search button text); KPI labels      |
| `PULSE.textDim`    | `#52525b`   | `text-zinc-600`     | theme.ts:19 | `widgets.tsx:53` (date label); chart axis labels       |

### Accents (signal colors)

| Token                | Hex (default) | Defined at  | Use                                                                                |
| -------------------- | ------------- | ----------- | ---------------------------------------------------------------------------------- |
| `PULSE.violet`       | `#ffffff` (dark) / `#0a0a0a` (light) | theme.ts:41 | The **accent surface**. Pipeline-bar gradient, chart line + gradient, hover dot, primary buttons, sidebar `+ New`, inline `+` buttons, `CardHeaderLink`, scorecard headline value, dashboard greeting first name. |
| `PULSE.violetSoft`   | tracks the accent | theme.ts:42 | Gradient-end variant of the accent. Same color when overridden by the picker.      |
| `PULSE.violetFgVar`  | `#0a0a0a` (dark) / `#ffffff` (light) | theme.ts | Contrast text/glyph that sits **on top of** an accent surface. Auto-computed by luminance when an override is picked. |
| `PULSE.violetGlow`   | `rgba(255,255,255,0.18)` (dark) / `rgba(0,0,0,0.18)` (light) | theme.ts:43 | Glow on accent buttons (see §7 for the 16px / 12px rule). Tracks the accent under override. |
| `PULSE.green`        | `#22c55e`   | theme.ts:44 | Positive delta chip bg/text; LiveBadge dot; first activity item                    |
| `PULSE.red`          | `#ef4444`   | theme.ts:45 | Negative delta chip bg/text; dashboard's Close rate KPI                            |
| `PULSE.cyan`         | `#22d3ee`   | theme.ts:46 | Third activity item dot                                                            |

### Accent override rule (mandatory)

**The accent is user-configurable.** Every surface in the table above
must tint to a single source of truth — `var(--color-violet)` — so a
user choosing a custom accent in **Settings → Profile → Accent color**
recolors all of them at once.

Concrete rules every new component must follow:

1. **Painting an accent surface (bg, fill, stroke, gradient stop):**
   reference `PULSE.violetVar` (or `var(--color-violet)` from CSS).
   Never use `PULSE.violet` (the bare hex) for live surfaces —
   that's reserved for opacity concatenation
   (`${PULSE.violet}1F` → `#ffffff1F`).
2. **Text/glyphs sitting on top of an accent surface:** use
   `PULSE.violetFgVar` (`var(--color-violet-foreground)`). Never
   hard-code `#fff` or `text-white` on an accent surface — it makes
   the glyph invisible when the accent itself is white (default dark
   mode) or when the user picks a light accent.
3. **Primary buttons:** use `bg-primary text-primary-foreground`
   (shadcn bridge — `--primary` is bound to `--color-violet` and
   `--primary-foreground` to `--color-violet-foreground`).
   `bg-slate-900 ... text-white` and `bg-sky-400 ... text-white`
   patterns from the legacy slate-CTA era have been swept; new code
   never reintroduces them.
4. **`CardHeaderLink` and link-style CTAs ("View all →"):** color is
   `PULSE.violetVar`. They tint with the accent and stay legible on
   both light and dark surfaces because the default flips between
   white and near-black.
5. **Chart lines/strokes/gradients:** set `color: PULSE.violetVar`
   on the `<svg>` (or the wrapping element) and use `currentColor`
   on `stroke` and `stopColor` so a single inline style controls
   line + fill together. See `widgets.tsx:HeroChart` for the
   canonical pattern.
6. **Headline numbers tinted with the accent** (scorecard
   `Nick Gaines $5.9K`, dashboard `Nick.` after the greeting): wrap
   the value in a `<span style={{ color: PULSE.violetVar }}>`. Don't
   set the whole heading to the accent color — only the value part.
7. **Tinted backgrounds with opacity** (`${PULSE.violet}1F`,
   `${PULSE.violet}33`): keep using the bare-hex `PULSE.violet`.
   String-concatenated opacity doesn't work with `var(--…)`. These
   sites accept that the tint stays at the default white (dark) /
   near-black (light) and don't recolor when a custom accent is
   picked. That's intentional — those are decorative chips, not
   accent surfaces.

### Defaults (no override)

| Theme | `--color-violet` | `--color-violet-foreground` |
| ----- | ---------------- | --------------------------- |
| Dark (default)  | `#ffffff` | `#0a0a0a` |
| Light (`data-theme="light"`) | `#0a0a0a` | `#ffffff` |

### Persistence

The chosen accent is stored in `localStorage` under `forge-accent`
(a 6-digit hex). An inline `<script>` in `app/layout.tsx` reads it
and writes the four `--color-violet*` CSS variables on
`document.documentElement.style` **before paint**, so there's no
flash of the default accent on first load. Foreground and glow are
auto-computed from the chosen accent by luminance — call sites
don't pass them explicitly.

**Removed tokens** (`greenSoft`, `pink`, `pinkSoft`, `amber`) were
defined but had zero call sites across the Pulse surfaces. They were
removed from `theme.ts`, `globals.css`, and `tailwind.config.ts` rather
than reserved — see §10 #13. When a future feature actually needs a
warning / alert / highlight color, that commit introduces a properly-
named role token tied to a real call site.

### Conventions for accents

- **Tinted background, full-color text** for chips: `${color}1F` for bg
  (12% opacity), `${color}` for text. See `widgets.tsx:113-114`,
  `widgets.tsx:805-807` (activity avatar), `widgets.tsx:806`.
- **Outlined ring** for chips that need a border: `${color}33` (20% opacity)
  for the border. See `widgets.tsx:807` (activity avatar border).
- **Glow shadow** for violet primary CTA buttons (locked):
  - **`shadow-glow-violet`** = `0 0 16px ${PULSE.violetGlow}` on
    full-width / pill-shaped buttons (e.g. Sidebar `+ New`).
  - **`shadow-glow-violet-sm`** = `0 0 12px ${PULSE.violetGlow}` on
    compact icon buttons (≤32px, e.g. Tasks card `+`).
  - No third value. Glow size scales with button footprint. Both tokens
    resolve via Tailwind's `boxShadow` extension to the corresponding
    CSS variable in `globals.css`; the inline `style={{ boxShadow }}`
    form is no longer used on Pulse surfaces.

---

## 4. Typography scale

Every value below is taken from running code. The dashboard does not use
`line-height` overrides except `leading-none` on big numbers; otherwise
`line-height` is Tailwind's default per font-size.

| Role                         | Class                                                                                 | Effective values                                          | Defined at                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| **H1 — page title**          | `text-page-title` *(token; pair with `text-white` + optional `tabular-nums`)*         | 40px / weight 800 / lh 1 / tracking -0.025em              | `tailwind.config.ts` `fontSize.page-title` |
| **H1 — dashboard greeting**  | `text-[48px] font-extrabold tracking-tight leading-none`                              | 48px / weight 800 / lh 1 / tracking -0.025em              | `widgets.tsx:57`                            |
| **H1 — chart card headline** | `text-[52px] font-black tracking-tight leading-none`                                  | 52px / weight 900 / lh 1 / tracking -0.025em              | `widgets.tsx:431`                           |
| **H2 — card title**          | `text-[15px] font-extrabold tracking-tight`                                           | 15px / weight 800 / lh 1.5 (default) / tracking -0.025em  | `widgets.tsx:566` (Schedule), :617 (Pipeline), :696 (Inbox), :720 (Tasks), :788 (Activity) |
| **H3 — empty-state title**   | `text-sm font-extrabold`                                                              | 14px / weight 800 / lh 1.25                               | `widgets.tsx` empty-state                   |
| **Subtitle (under H1)**      | `text-sm font-bold`                                                                   | 14px / weight 700 / lh 1.25                               | `PageHeader.tsx` subtitle slot              |
| **Section subheading**       | `text-lg font-extrabold tracking-tight text-fg leading-none`                          | 18px / weight 800 / lh 1 / tracking -0.025em              | `ReportsClient.tsx` `Section()`             |
| **Section subheading caption** | `text-sm font-bold text-zinc-500 leading-snug` *(with `mt-1.5` under the heading)*  | 14px / weight 700 / lh 1.375                              | `ReportsClient.tsx` `Section()`             |
| **Body — small subtitle**    | `text-[12px] font-bold`                                                               | 12px / weight 700                                         | `widgets.tsx` Pipeline "35 active"          |
| **Body — activity item**     | `text-[12.5px] font-bold leading-snug`                                                | 12.5px / weight 700 / lh 1.375                            | `widgets.tsx` activity body                 |
| **Body — schedule row name** | `text-[14px] font-bold`                                                               | 14px / weight 700                                         | `widgets.tsx` schedule row                  |
| **Body — schedule row addr** | `text-[12px] font-bold`                                                               | 12px / weight 700                                         | `widgets.tsx` schedule row                  |
| **Page-level / hero kicker** | `text-[11px] uppercase tracking-[0.22em] font-extrabold`                              | 11px / weight 800 / tracking 0.22em                       | `PageHeader.tsx` kicker; chart card kicker  |
| **KPI label / eyebrow**      | `text-eyebrow uppercase` *(token; pair with `uppercase` + color utility e.g. `text-zinc-500`)* | 11px / weight 800 / lh 1 / tracking 0.18em        | `tailwind.config.ts` `fontSize.eyebrow`     |
| **Table column header**      | `text-eyebrow-tight uppercase` *(token; pair with `uppercase` + color utility)* | 11px / weight 800 / lh 1 / tracking 0.16em                | `tailwind.config.ts` `fontSize.eyebrow-tight` |
| **KPI label (raw)**          | `text-[11px] uppercase tracking-[0.18em] font-extrabold`                              | 11px / weight 800 / tracking 0.18em                       | `widgets.tsx:101` (kept on Pulse surfaces)  |
| **Inbox indicator label**    | `text-[10.5px] uppercase tracking-[0.18em] font-extrabold`                            | 10.5px / weight 800 / tracking 0.18em                     | `widgets.tsx:698-699`                       |
| **LiveBadge label**          | `text-[10px] uppercase tracking-[0.18em] font-bold`                                   | 10px / weight 700 / tracking 0.18em                       | `widgets.tsx:744`                           |
| **Schedule AM/PM**           | `text-[10px] font-bold tracking-[0.18em]`                                             | 10px / weight 700 / tracking 0.18em                       | `widgets.tsx:491`                           |
| **Activity item time**       | `text-[10.5px] font-bold uppercase tracking-[0.16em]`                                 | 10.5px / weight 700 / tracking 0.16em                     | `widgets.tsx:823`                           |
| **Tooltip date**             | `text-[10px] font-extrabold uppercase tracking-[0.16em]`                              | 10px / weight 800 / tracking 0.16em                       | `widgets.tsx:348`                           |
| **KPI value — chart hero**   | `text-[52px] font-black tracking-tight leading-none tabular-nums`                     | 52px / weight 900                                         | `widgets.tsx` chart headline                |
| **KPI value — Compact**      | `text-[26px] font-black tracking-tight leading-none tabular-nums`                     | 26px / weight 900                                         | `widgets.tsx` CompactHeroKpi                |
| **KPI value — stat card**    | `text-[32px] font-bold tracking-tight leading-none tabular-nums` (compact: `text-[24px]`) | 32px / weight 700 (compact 24px)                          | `ReportsClient.tsx` JobStatCard, StatCard, SalesValueCard |
| **KPI value — stat secondary** | `text-[26px] font-bold tracking-tight leading-none tabular-nums`                    | 26px / weight 700                                         | `ReportsClient.tsx` BigStatCard, `Stats` row|
| **Stat card description**    | `text-[14px] font-semibold text-zinc-400 leading-snug` (compact: `text-xs`)               | 13px / weight 700 / lh 1.375                              | `ReportsClient.tsx` JobStatCard, StatCard, SalesValueCard, BigStatCard, `Stats` row description |
| **Range pill label**         | `text-[11.5px] font-extrabold`                                                        | 11.5px / weight 800                                       | `widgets.tsx:446`                           |
| **`CardHeaderLink`**         | `text-[11.5px] font-extrabold` (color = `PULSE.violetSoft`)                          | 11.5px / weight 800                                       | `CardHeaderLink` in `widgets.tsx`           |
| **Sidebar nav row**          | `text-[13.5px] font-bold` (idle) / `font-extrabold` (active)                          | 13.5px                                                    | `Sidebar.tsx:226`                           |
| **Sidebar section header**   | `text-[10px] uppercase tracking-[0.2em] font-bold`                                    | 10px / weight 700 / tracking 0.2em                        | `Sidebar.tsx:169`                           |
| **Sidebar `+ New` button**   | `text-[13px] font-extrabold`                                                          | 13px / weight 800                                         | `Sidebar.tsx:127`                           |
| **Sidebar new-menu item**    | `text-[13px] font-bold`                                                               | 13px / weight 700                                         | `Sidebar.tsx:151`                           |
| **Sidebar profile name**     | `text-[12.5px] font-bold`                                                             | 12.5px / weight 700                                       | `Sidebar.tsx:203`                           |
| **Sidebar sign-out button**  | `text-[12.5px] font-bold`                                                             | 12.5px / weight 700                                       | `Sidebar.tsx:212`                           |
| **Sidebar brand name**       | `text-[15px] font-extrabold tracking-tight`                                           | 15px / weight 800                                         | `Sidebar.tsx:114`                           |
| **Schedule price column**    | `text-[14px] font-bold tabular-nums`                                                  | 14px / weight 700                                         | `widgets.tsx` schedule row                  |
| **Pipeline stage label**     | `text-[12.5px] font-bold`                                                             | 12.5px / weight 700                                       | `widgets.tsx` Pipeline                      |
| **Pipeline count/value**     | `text-[11px] font-bold tabular-nums`                                                  | 11px / weight 700                                         | `widgets.tsx` Pipeline                      |
| **Search input placeholder** | `text-[13px] font-bold` (text style on search button)                                 | 13px / weight 700                                         | `widgets.tsx:66`                            |
| **Chart axis Y label**       | `text-[11px] font-extrabold`                                                          | 11px / weight 800 / no uppercase                          | `widgets.tsx:282`                           |
| **Chart axis X label (day)** | `text-[11px] font-extrabold`                                                          | 11px / weight 800                                         | `widgets.tsx:301`                           |
| **Chart "no data" / loading**| `text-[13px] font-extrabold`                                                          | 13px / weight 800                                         | `widgets.tsx:163`                           |

### Uppercase tracking scale

**Banned everywhere except the sidebar group header.** The
spaced-out all-caps eyebrow pattern was swept out of every production
surface in commit (see PR for the SHA). It is permitted in **exactly one
place**: the left-rail sidebar group headers in
`components/pulse/Sidebar.tsx` ("Workspace", "Pipeline", "Inbox",
"Insights", "Team"). Nowhere else.

The historical three-tier tracking scale (0.22em / 0.18em / 0.16em
with `uppercase font-extrabold`) is retired. The `text-eyebrow` and
`text-eyebrow-tight` font-size tokens still exist in
`tailwind.config.ts` for the sidebar group header only; do not pair
them with `uppercase` anywhere else.

### Label scale

Use these wherever a small gray supporting label used to be uppercase.

- **Page section heading** — `text-[22px] font-extrabold tracking-tight text-fg`.
  No description / subtitle line beneath (see §10 #25).
- **Stat-card / KPI top label** (e.g. "Scheduled", "Close Rate",
  "Cash Collected", "Total ARR") — `text-[14px] font-semibold text-zinc-500`.
  Always the literal Tailwind class `text-zinc-500` — do not use
  inline `PULSE.textSubtle` style for this token, so every stat card
  in the CRM resolves to exactly the same color value.
- **Stat-card / KPI bottom supporting line** (the dollar amount under a
  count, the one-line description below the value, etc.) — `text-[13px]
  font-bold text-zinc-400`. Same size and weight as the top label,
  brighter color (zinc-400 vs zinc-500) so it reads as supporting
  rather than recessive. Always the literal Tailwind `text-zinc-400`
  class — never the inline `PULSE.textMuted` / `PULSE.textDim` styles.
- **Chart-card / dashboard hero eyebrow** (the "Revenue · This Month"
  label above the dashboard hero chart and similar chart-card labels)
  uses the same top-label scale — `text-[14px] font-semibold text-zinc-500`.
- **Card sub-header, table column header, form-field label, legend chip,
  chart-tooltip date, donut-center label, "X unread" indicator** —
  `text-xs font-bold text-zinc-500` (use `text-zinc-400` if you need
  stronger contrast). Never `uppercase`, never `tracking-[…]`.
- **Inline status pill** (colored bg) — `text-xs font-bold` plus the
  color tokens (`text-emerald-300 bg-emerald-500/20` etc.), Title Case
  text, `rounded-full px-2 py-0.5`.

### Stat-card structure

Every stat / KPI card in the CRM is a top-aligned vertical stack
inside a single shared wrapper:

```jsx
<div className="bg-card border border-line rounded-2xl px-5 py-4">
  <div className="text-[14px] font-semibold text-zinc-500">{label}</div>
  <div className="mt-2.5 text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-white">
    {value}
  </div>
  {bottom && (
    <div className="mt-2.5 text-[14px] font-semibold text-zinc-400">
      {bottom}
    </div>
  )}
</div>
```

Rules:

1. **Wrapper** — always `bg-card border border-line rounded-2xl px-5
   py-4`. Literal Tailwind tokens, no inline `PULSE.card` /
   `PULSE.cardBorder` styles. **No `min-h-*`** — the card hugs its
   content. **No `flex flex-col` / `flex-1`** wrapper around the value
   — the value is not vertically centered, it sits 10 px below the
   label on a `mt-2.5`.
2. **Top label** — `text-[14px] font-semibold text-zinc-500`. Title Case.
3. **Center value** — `text-[28px] font-extrabold tracking-tight
   leading-none tabular-nums text-white`. 10 px gap below the label
   (`mt-2.5`). 28 px / weight 800 / white on every stat card in the
   CRM — the big number is the only line that uses `font-extrabold`.
4. **Bottom supporting line** (optional) — `text-[14px] font-semibold
   text-zinc-400`. 10 px gap below the value (`mt-2.5`). Same size and
   weight as the top label, one tone brighter (zinc-400 vs zinc-500).
   Literal Tailwind class — no inline `PULSE.textMuted` /
   `PULSE.textDim` style. One line only (see §10 #24).

### Delta indicator

The colored ± delta pill (e.g. `+8.6% / −1.1%`) lives **only on the
dashboard `CompactHeroKpi`**, rendered in the top-right corner of the
card alongside the label via `flex items-start justify-between`. No
other stat-card variant (Reports `JobStatCard` / `BigStatCard` /
`SalesValueCard` / `StatCard` / `Stats`, sales-rep `Kpi`, tech-stats
`Kpi`, `LeaderboardClient.KpiCard`, customer-detail `Stat`) renders
a delta — they're pure label / value / optional bottom-line stacks.
If a Reports widget needs to show change, surface it in the bottom
supporting line as plain text, not a colored pill.

### Widget label casing — Title Case

Every widget label uses **Title Case** — capitalize the first letter of
every word. "Close Rate", not "Close rate". "Jobs Sold", not "Jobs
sold". "Cash Flow", not "Cash flow". "Top Reps", not "Top reps". "This
Month", not "This month". Applies to: stat-card top labels, chart card
titles, section headings, KPI labels, pipeline-stage labels,
leaderboard card labels, date-range pill titles, status pill text — any
widget-level label.

- Short connector words in multi-word labels keep lowercase (`vs`, `of`,
  `to`, `for`, `and`, `or`, `in`, `on`, `the`, `a`, `an`) — e.g.
  "First-Time vs Repeat". Use sparingly.
- Sentence-case is reserved for **sentences**, not labels — empty-state
  prompts ("Nothing on the calendar.", "No recent conversations."),
  form-field labels ("First name", "Email"), modal section titles inside
  forms. Those are full sentences / conventional form labels, not widget
  labels.

Narrow exceptions that are not "eyebrow" styling:
- **2-letter US state / region code input** (`customers/AddressFields.tsx`,
  the Settings region field) — the CSS `uppercase` transform is
  data-semantic (state abbreviations are conventionally uppercase),
  paired with `.toUpperCase()` in JS.
- **Naturally-uppercase abbreviations as literal content** (AM / PM,
  USD, MRR, ARR) — fine as written content, but never paired with
  extra `tracking-[…]`.

If you find yourself reaching for `uppercase` + `tracking-[…]` outside
the sidebar group header, stop and use the label scale above.

### Numeric weight scale

- **`font-black tabular-nums`** — reserved for **page-hero** numbers on
  the dashboard chart hero (52px) and Pulse `CompactHeroKpi` (26px).
  These are the dominant element of a page, not card-level metrics.
- **`font-bold tabular-nums`** — every **stat-card KPI value** on the
  Reports surface (Jobs cards 28px, Subscriptions cards 28px,
  `BigStatCard` / `Stats` row 22px, compact `StatCard` 20px). Also
  used for inline / row-level numbers (prices in table rows, pill
  counts, pipeline counts).
- `font-extrabold` is reserved for headings and uppercase labels —
  **never used on numbers**.
- Anything that's a money / count value gets `tabular-nums` to prevent
  digit-width jitter on live updates.

**Rule of thumb:** if the number is the dominant element of the page
(48px+, single largest number on the screen) use `font-black`. If it's
one of several stat-card values stacked in a row, use `font-bold`.

### Weights actually used on the Pulse surfaces

- `font-bold` (700) — body, schedule rows, profile, sign-out, sidebar nav, "0 unread", LiveBadge label, tooltip date prefix, all row-level numerics, `CardHeaderLink`'s siblings
- `font-extrabold` (800) — every uppercase label, card titles (H2), CompactHeroKpi label, range pills, sidebar `+ New`, empty-state title, chart axis labels, `CardHeaderLink`
- `font-black` (900) — hero numbers ≥ 24px (KPI value, chart headline, chart tooltip dollar value)
- `font-semibold` (600) — **not used on Pulse surfaces.** The previous three call sites (schedule row address, schedule technician name, activity item body) are now `font-bold`. Non-Pulse pages still use `font-semibold` and will be migrated when those pages move onto Pulse primitives.

---

## 5. Spacing & layout values

### Container

| Value                              | Where                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `max-w-app mx-auto px-10 py-10`    | App content container — `(app)/layout.tsx:14`. `max-w-app` resolves to `--layout-app-max-width` (1440px) via Tailwind's `maxWidth` extension. |
| `w-60` (240px)                     | Sidebar width — `Sidebar.tsx:106`                                  |
| `ml-60` (240px)                    | Main column offset — `(app)/layout.tsx:13`                         |

### Section / row spacing

| Value      | Where                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| `mb-3`     | After date label (`widgets.tsx:52`); after section H3-style label (`widgets.tsx:425`)     |
| `mb-4`     | Card title row (Schedule, Pipeline, Inbox, Tasks, Activity)                               |
| `mb-5`     | Inside chart card — between header and chart (`widgets.tsx:422`); dashboard sections gap (`(app)/page.tsx:39, 60, 64`) |
| `mb-7`     | Below page header (`widgets.tsx:49`)                                                      |
| `gap-3`    | KPI strip & 3-up bottom row (`(app)/page.tsx:69`)                                         |
| `gap-4`    | KPI strip on dashboard top (`(app)/page.tsx:39`); card title actions (`widgets.tsx:565`)  |
| `gap-5`    | 2-up middle row (`(app)/page.tsx:64`); chart hero header gap                              |
| `space-y-2` | Schedule rows (`widgets.tsx:584`)                                                        |
| `space-y-3` | Sidebar nav sections (`Sidebar.tsx:162`)                                                 |
| `space-y-3.5` | Activity feed (`widgets.tsx:799`)                                                      |
| `space-y-4` | Pipeline stages (`widgets.tsx:622`)                                                     |
| `space-y-0.5` | Sidebar nav rows (`Sidebar.tsx:174`)                                                   |

### Card padding scale

Three tiers, intentional:

| Class            | Card             | Where                               |
| ---------------- | ---------------- | ----------------------------------- |
| `px-5 py-4`      | CompactHeroKpi   | `widgets.tsx:96`                    |
| `p-6`            | Schedule, Pipeline, Inbox, Tasks, Activity | `widgets.tsx:562, 613, 692, 716, 784` |
| `p-7`            | Chart hero       | `widgets.tsx:419`                   |

### Mobile safe-area bottom

iOS PWAs and mobile browsers reserve a strip at the bottom of the
viewport for the home indicator (~34px on notched iPhones). Content
that hugs the bottom edge — message input bars, modal action rows,
fixed docks, page content under `AppFrame` — gets clipped or feels
cramped against the indicator if no inset is reserved. Even on
flat-bottom Android, sitting flush with the screen edge looks rushed.

The token `--safe-bottom` in `globals.css` resolves to
`max(env(safe-area-inset-bottom), 1rem)` — the iOS inset (≈34px on
notched devices, 0 elsewhere) with a 16px floor so flat-bottom phones
still get breathing room.

Apply additively on top of an element's own bottom padding:

| Where                              | Padding-bottom                                         |
| ---------------------------------- | ------------------------------------------------------ |
| `AppFrame` inner container (mobile) | `pb-[calc(1rem+var(--safe-bottom))]` — overridden by `md:py-10` on desktop |
| Messages thread input bar          | `pb-[calc(0.75rem+var(--safe-bottom))] md:pb-3`        |
| Floating `PhoneClient` dock        | `bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` (raw inset — no mobile floor needed since the dock has shadow + radius) |
| Tailwind spacing alias             | `safe-b` → `var(--safe-bottom)` (use as `pb-safe-b`, `mb-safe-b`, `bottom-safe-b`) |

**Rule.** Any new mobile surface with content stuck to the bottom edge
must reserve `var(--safe-bottom)` of padding-bottom (added to its own
internal padding) so the content sits comfortably above the home
indicator. Desktop (`md:` and up) keeps its existing spacing — override
with `md:pb-*` if the mobile-additive padding doesn't suit desktop.

For full-bleed pages (`/messages`, `/schedule`, `/map`) the rule applies
to whichever element is bottom-stuck inside the page. For non-full-bleed
pages, `AppFrame` already reserves the inset on every page that routes
through it.

### Sidebar internal spacing

| Value          | Where                  |
| -------------- | ---------------------- |
| `px-3 py-4`    | Sidebar root           | `Sidebar.tsx:106`     |
| `px-2 py-2`    | Brand row              | `Sidebar.tsx:111`     |
| `mt-2`         | Above `+ New`          | `Sidebar.tsx:123`     |
| `mt-4`         | Above nav list         | `Sidebar.tsx:162`     |
| `pt-3`         | Above profile section  | `Sidebar.tsx:185`     |
| `px-3 py-2`    | Nav row                | `Sidebar.tsx:225`     |

---

## 6. Border radius

| Value          | Where used                                                                              |
| -------------- | --------------------------------------------------------------------------------------- |
| `rounded-md`   | Delta chip (`widgets.tsx:111`)                                                          |
| `rounded-lg`   | Sidebar nav row (`Sidebar.tsx:225`); sidebar sign-out (`Sidebar.tsx:212`)                |
| `rounded-xl`   | Sidebar `+ New` (`Sidebar.tsx:127`); new-menu container (`Sidebar.tsx:139`); schedule rows (`widgets.tsx:482`); chart loading skeleton (`widgets.tsx:460`); activity avatar; tooltip (`widgets.tsx:335`) |
| `rounded-2xl`  | **Default card.** CompactHeroKpi (`widgets.tsx:96`); chart hero (`widgets.tsx:419`); Schedule, Pipeline, Inbox, Tasks, Activity (all `:562, :613, :692, :716, :784`); header search button (`widgets.tsx:66`)            |
| `rounded-full` | Range pill bar (`widgets.tsx:437`); range pill button (`widgets.tsx:446`); status chip (`widgets.tsx:532, 541`); progress bar track (`widgets.tsx:635`); progress bar fill (`widgets.tsx:639`); profile photo (`Sidebar.tsx:188`); LiveBadge dot (`widgets.tsx:748`); activity dot/avatar (`widgets.tsx:803`); chart hover dot (`widgets.tsx:320`) |

`rounded-3xl` is **not** used anywhere on the dashboard.

---

## 7. Shadows / elevation

The dashboard mostly uses **flat surfaces with borders** (`#1f1f24`) — no
elevation shadows on cards. The only shadows in the component tree:

| Token                  | Resolved value                                          | Element                          | Where                       |
| ---------------------- | ------------------------------------------------------- | -------------------------------- | --------------------------- |
| `shadow-glow-violet`   | `0 0 16px rgba(139,92,246,0.35)` (PULSE.violetGlow)     | Sidebar `+ New` button           | `Sidebar.tsx:131`           |
| `shadow-glow-violet-sm`| `0 0 12px rgba(139,92,246,0.35)`                        | Tasks card inline `+` button     | `widgets.tsx:726`           |
| `shadow-glow-green`    | `0 0 8px ${PULSE.green}` (~rgba(34,197,94,1))           | LiveBadge dot                    | `widgets.tsx:749`           |
| `shadow-menu`          | `0 12px 28px -8px rgba(0,0,0,0.5)`                      | Sidebar new-menu dropdown        | `Sidebar.tsx:143`           |
| `shadow-tooltip`       | `0 8px 24px -8px rgba(0,0,0,0.6)`                       | Chart hover tooltip card         | `widgets.tsx:343`           |
| (inline)               | `0 0 0 3px PULSE.bg`                                    | Chart hover dot ring             | `widgets.tsx:328`           |
| (inline)               | `0 0 0 1px ${color}33` (border-style ring)              | Activity avatar (treated as ring)| `widgets.tsx:807`           |

The first five shadows are exposed as Tailwind utility classes via the
`boxShadow` theme extension in `tailwind.config.ts`; each reads from a
CSS variable defined in `globals.css`. The bottom two (chart hover dot
ring and activity avatar ring) are still applied inline because their
values are dynamic — `PULSE.bg` for the dot and the per-item accent
`${color}33` for the avatar. New work should pull from one of the
patterns above; don't introduce new shadow values. The two violet
glows are governed by the size rule in §3 (16px on full-width / pill
buttons, 12px on compact icon buttons).

There is **no** systematic elevation scale (e.g. `shadow-sm` / `shadow-md`).
Each shadow is hand-tuned for its widget.

---

## 8. Component primitives

The dashboard imports these primitives from `components/pulse/widgets.tsx`,
`components/pulse/Sidebar.tsx`, `components/pulse/Icon.tsx`, and
`components/pulse/PageHeader.tsx`.

**Primitive policy** (per §10 #10): primitives are generated proactively
(e.g. via shadcn/ui in a separate step) rather than gated on per-feature
need. **Any new primitive must land with a §8 sub-entry in this document
in the same commit that introduces it** — no exceptions.

The list of canonical primitives in `components/pulse/` will grow over
time. Inline buttons / inputs / chips that pre-date a primitive's
introduction get migrated as their files are touched.

### 8.1 `PulseSidebar`

Defined: `Sidebar.tsx:63-235`. Used: `(app)/layout.tsx:12`.

**Structure** (top → bottom):

1. Brand row — `Sidebar.tsx:110-120` — `px-2 mb-1`, 9×9 placeholder square + 15px font-extrabold `Forge CRM` text
2. `+ New` button — `Sidebar.tsx:122-159` — full width, h-10, violet bg with violet glow, dropdown menu of `NEW_ITEMS` (`Sidebar.tsx:46-52`)
3. Nav list — `Sidebar.tsx:162-182` — sectioned (`Workspace`, `Insights`, `Team`); each section header is `Sidebar.tsx:168-173`, each row is `PulseNavRow` (`Sidebar.tsx:222-263`). The **Inbox** row uses an optional `matchPrefixes` array to also highlight on `/calls` and `/email` since those are sub-tabs inside the unified Inbox surface (see `InboxTabs`). Create-button shortcuts (Estimates, Invoices, Subscriptions) intentionally do **not** appear in the sidebar — they're accessible only via the `+ Create` dropdown, since the sidebar entries used to be pure duplicates of the Create flow.
4. Profile + sign out — `Sidebar.tsx:185-218` — top-bordered (1px `PULSE.divider`); 7×7 avatar with photo or initials (`Sidebar.tsx:187-201`); name (`Sidebar.tsx:202-207`); sign-out button (`Sidebar.tsx:209-217`)

**Active nav row** — `Sidebar.tsx:241-253`:
- Background: `PULSE.cardBorderHi` (#2a2a32)
- Color: `PULSE.text` (#fff)
- Weight: `font-extrabold`

**Idle nav row**:
- Color: `PULSE.textMuted` (#a1a1aa)
- Weight: `font-bold`
- Hover: `bg-[#0a0a0a]` (`PULSE.bgAlt`).

Active rows have `bg-cardBorderHi`; idle rows pick up `PULSE.bgAlt` on
hover for affordance.

### 8.2 `PageHeader`

Defined: `components/pulse/PageHeader.tsx`. Used: `(app)/page.tsx`
(dashboard composes the kicker / title / subtitle / actions itself).

**Props:**

```ts
{
  kicker?: React.ReactNode;     // small uppercase label above title
  title: React.ReactNode;       // H1 content
  subtitle?: React.ReactNode;   // body line below title
  actions?: React.ReactNode;    // right-aligned slot (buttons, badges)
}
```

**Internal structure:**
- Wrapper: `flex items-end justify-between gap-4 flex-wrap mb-7`
- **Kicker** (when provided): `text-[11px] uppercase tracking-[0.22em] font-extrabold mb-3`, color `PULSE.textDim` — the §4 page-level / hero kicker token.
- **Title (H1)**: `text-[48px] font-extrabold tracking-tight leading-none`.
- **Subtitle** (when provided): `text-sm mt-3 font-bold`, color `PULSE.textMuted`.
- **Actions** (when provided): right-aligned `flex items-center gap-2` slot.

The dashboard composes its greeting + "Search anything" button at the
call site, which means future pages can reuse the same primitive without
inheriting any dashboard-only chrome.

### 8.3 `CompactHeroKpi`

Defined: `widgets.tsx:83-121`. Used: `(app)/page.tsx:40-57`.

**Structure** (`widgets.tsx:94-120`):
- Card: `rounded-2xl px-5 py-4`, bg `PULSE.card`, border `PULSE.cardBorder`
- Layout: `flex items-center justify-between gap-4`
- **Label** (`widgets.tsx:100-105`): `text-[11px] uppercase tracking-[0.18em] font-extrabold mb-1.5`, color `PULSE.textSubtle`
- **Value** (`widgets.tsx:106-108`): `text-[26px] font-black tracking-tight leading-none tabular-nums`.
- **Delta chip** (`widgets.tsx:110-118`): `text-[11px] px-2 py-0.5 rounded-md font-extrabold`,
  bg `${color}1F`, text `${color}` where color is `PULSE.green` (positive)
  or `PULSE.red` (negative)

**Hover / focus / disabled:** none defined.

### 8.4 `PulseChartHero` + `HeroChart`

Defined: `widgets.tsx:386-468` (PulseChartHero), `widgets.tsx:147-361` (HeroChart). Used: `(app)/page.tsx:61`.

**Card** (`widgets.tsx:418-421`): `rounded-2xl p-7`, bg `PULSE.card`,
border `PULSE.cardBorder`.

**Header** (`widgets.tsx:422-457`):
- Section label: `text-[11px] uppercase tracking-[0.22em] font-extrabold mb-3`, color `PULSE.textSubtle`. Format: `Revenue · {titleLabel}` where `titleLabel` is one of "Last 7 days" / "This month" / "Last 3 months". Same kicker token as the page-level kicker — see §4 tracking scale.
- Headline (`widgets.tsx:430-433`): `text-[52px] font-black tracking-tight leading-none`. Shows `formatCentsShort(total_cents)` from API, or `—` while loading.
- Range pills (`widgets.tsx:436-456`): pill bar `flex items-center gap-1 p-1 rounded-full`, bg `PULSE.bgAlt`. Each pill `px-3.5 py-1 rounded-full text-[11.5px] font-extrabold`. Active pill bg = `PULSE.text` (#fff) with text `PULSE.bg` (#000); idle text = `PULSE.textMuted`.

**Range options** (`widgets.tsx:370-374`):
- `1w` → `"7D"` → `"Last 7 days"`
- `1m` → `"1M"` → `"This month"`  (default)
- `3m` → `"3M"` → `"Last 3 months"`

**Data fetching** (`widgets.tsx:393-411`): self-fetches `/api/revenue?range=...` on mount and whenever `range` state changes. Default `initialRange="1m"`.

**Loading skeleton** (`widgets.tsx:458-462`): `rounded-xl animate-pulse`, bg `PULSE.bgAlt`, same height as the chart.

**HeroChart interactions** (`widgets.tsx:147-361`):
- White stroke path (`widgets.tsx:256-263`): `stroke="#ffffff"`, width 3, round caps + joins
- Area gradient (`widgets.tsx:236-239`): white at 18% opacity → 0%
- Y-axis grid lines (`widgets.tsx:241-254`): horizontal at 0 / 25% / 50% / 75% / 100%, dashed `2 4`, color `PULSE.cardBorder`
- Y labels (`widgets.tsx:277-296`): HTML overlay, right-aligned in left padding zone (44px wide), shows `$<rounded-down dollars>` per tick
- X labels (`widgets.tsx:297-312`): HTML overlay at `bottom: 4`, day-of-month numbers, every nth day (math: `Math.ceil(days.length / 10)`)
- **Hover crosshair** (`widgets.tsx:264-274`): vertical dashed line at hovered X, color `PULSE.textDim`
- **Hover dot** (`widgets.tsx:317-331`): 12×12 white circle with 3px black ring
- **Hover tooltip** (`widgets.tsx:332-357`): bg `PULSE.card`, 1px border `PULSE.cardBorderHi`, `rounded-lg px-2.5 py-1.5`. Date in micro-uppercase; dollar value in `font-black tracking-tight tabular-nums`. Positioned 36px above the hovered point.
- Cursor on chart area: `cursor-crosshair` (`widgets.tsx:225`)
- Empty state (`widgets.tsx:160-168`): centered `text-[13px] font-extrabold`, color `PULSE.textDim`, "No data yet."

### 8.5 `PulseScheduleCard`

Defined: `widgets.tsx:553-592`. Used: `(app)/page.tsx:65`.

**Card** (`widgets.tsx:561-563`): `rounded-2xl p-6`, bg `PULSE.card`,
border `PULSE.cardBorder`.

**Header**:
- H2: `text-[15px] font-extrabold tracking-tight`, content "Today's schedule"
- "View all →" affordance: `<CardHeaderLink label="View all →" href="/schedule" />` — see §8.13.

**Empty state** (`widgets.tsx:577-583`): `PulseEmptyState` with calendar icon, "Nothing on the calendar", "Today's jobs will appear here once scheduled."

**Row** (`PulseScheduleRow` — `widgets.tsx:472-525`):
- Container: `flex items-center gap-4 px-3 py-3 rounded-xl`, bg `PULSE.bgAlt`, 1px border `PULSE.cardBorder`
- Time block (w-12, centered): `text-[18px] font-bold leading-none` (HH:MM) over `text-[10px] font-bold tracking-[0.18em]` color `PULSE.textDim` (AM/PM)
- Customer name (flex-1, truncate): `text-[14px] font-bold`
- Customer address (truncate, optional): `text-[12px] truncate font-bold`, color `PULSE.textSubtle`
- Status chip: see `PulseStatusChip`
- Technician (w-24, optional, hidden below `xl`): `text-[12px] font-bold`, color `PULSE.textMuted`
- Price column (w-20, right): `text-[14px] font-bold tabular-nums`, color `PULSE.text`.

### 8.6 `PulseStatusChip`

Defined: `widgets.tsx:527-551`.

Two variants:

- **"On the way" (active)** — `widgets.tsx:529-538`:
  `text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap`,
  bg `PULSE.text` (#fff), color `PULSE.bg` (#000). Triggered when status is `in_progress` or `on_the_way`.
- **Default (everything else)** — `widgets.tsx:539-550`:
  `text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap`,
  bg `PULSE.bgAlt`, color `PULSE.textMuted`, 1px border `PULSE.cardBorder`. Underscores in status replaced with spaces.

There is **no** color-tinted variant for completed / cancelled / scheduled
on the dashboard (pages elsewhere have their own status pills with
hardcoded accent colors).

### 8.7 `PulsePipelineCard`

Defined: `widgets.tsx:605-651`. Used: `(app)/page.tsx:66`.

**Card** (`widgets.tsx:611-614`): `rounded-2xl p-6`, bg `PULSE.card`,
border `PULSE.cardBorder`.

**Header** (`widgets.tsx:616-621`):
- H2: "Pipeline"
- Counter: `text-[12px] mt-1 font-bold` color `PULSE.textSubtle` — `"<n> active"`

**Row** (`widgets.tsx:622-650`):
- Layout: stacked `space-y-4`
- Stage name (`widgets.tsx:626`): `text-[12.5px] font-bold`
- Count + value: `text-[11px] font-bold tabular-nums`, color `PULSE.textSubtle`.
- Progress track: `h-1.5 rounded-full overflow-hidden`, bg `PULSE.cardBorder`
- Progress fill: `linear-gradient(90deg, ${PULSE.violet}, ${PULSE.violetSoft})`, width = `pct * 100%`

**Default data** (`widgets.tsx:598-603`): 4 placeholder stages — New leads / Contacted / Estimating / Won. **Not wired to real lead data yet.**

### 8.8 `PulseInboxCard` / `PulseTasksCard` / `PulseActivityCard`

All three: `rounded-2xl p-6`, bg `PULSE.card`, border `PULSE.cardBorder`.

**`PulseInboxCard`** — `widgets.tsx:689-711`:
- H2 "Inbox"
- Right-side micro label `0 unread` (`text-[10.5px] font-extrabold uppercase tracking-[0.18em]`, color `PULSE.textSubtle`)
- Empty state: message icon, "No recent conversations" / "New conversations will appear here."

**`PulseTasksCard`** — `widgets.tsx:713-739`:
- H2 "Tasks"
- Right-side icon button: 7×7 round, bg `PULSE.violet`, white plus, glow `shadow-glow-violet-sm`
- Empty state: doc icon, "No tasks yet" / "Create one to keep your team organized."

**`PulseActivityCard`** — `widgets.tsx:756-835`:
- H2 "Activity"
- Right-side `LiveBadge` (`widgets.tsx:741-754`): green dot with green glow + green uppercase "Live" label
- Items (synthetic from `jobs`): up to 3, each with a 7×7 avatar circle (tinted bg `${color}1F`, color `${color}`, 1px border `${color}33`) showing the first letter, a body line `text-[12.5px] font-bold leading-snug`, and an uppercase time label below `text-[10.5px] font-bold uppercase tracking-[0.16em]`.
- Empty state inline: `text-[12.5px] font-bold`, color `PULSE.textSubtle`, "No recent activity."

### 8.9 `PulseEmptyState`

Defined: `widgets.tsx:655-685`. Used by Schedule, Inbox, Tasks cards.

- Wrapper: `py-10 flex flex-col items-center text-center`
- Icon chip: `w-12 h-12 rounded-full`, bg `PULSE.bgAlt`, color `PULSE.textSubtle`, 1px border `PULSE.cardBorder`. Renders any `PulseIcon` by name.
- Title: `mt-3 text-sm font-extrabold`
- Sub: `text-[11.5px] mt-1 font-bold max-w-[20ch]`, color `PULSE.textSubtle`

### 8.10 `LiveBadge`

Defined: `widgets.tsx:741-754`.

- Layout: `flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]`
- Color: `PULSE.green`
- Dot: `w-1.5 h-1.5 rounded-full`, bg `PULSE.green`, glow `shadow-glow-green`

### 8.11 `PulseIcon`

Defined: `Icon.tsx:1-43`. SVG icon set with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinecap="round"`, `strokeLinejoin="round"`. Default size `w-4 h-4`. Special case: the `plus` icon overrides `strokeWidth={2.5}`.

Available names: `home`, `calendar`, `map`, `inbox`, `doc`, `check`, `wallet`, `message`, `phone`, `mail`, `chart`, `trophy`, `user`, `users`, `settings`, `plus`, `search`, `bell`, `chevron`, `logout`, `cart`, `mic`, `mic-off`, `phone-off`. Unknown name → empty circle (`Icon.tsx:35`).

`mic` / `mic-off` / `phone-off` were added to support the CallWidget
mute and hang-up affordances (see §10 #19). `mic-off` is the `mic`
glyph plus a diagonal slash; `phone-off` is the `phone` glyph plus a
diagonal slash — both follow the same `viewBox` / `strokeWidth` /
linecap conventions as the rest of the set.

### 8.13 `CardHeaderLink`

Defined: `widgets.tsx`. Used in `PulseScheduleCard` ("View all →"). The
canonical helper for any card-header right-side affordance that
navigates somewhere.

**Props:**

```ts
{
  label: string;
  href: string;
}
```

**Internal:** `<Link href={href}>` with `text-[11.5px] font-extrabold`
and color `PULSE.violetSoft`. New cards that need the same affordance
should import this rather than re-deriving the styling.

### 8.14 Primitive coverage map

The following table summarizes whether each primitive role exists, and
where. Pulse-specific primitives live in `components/pulse/` (the
hand-tuned widgets composed on the dashboard). General-purpose form,
overlay, and structural primitives — sourced from shadcn/ui canonical
templates and adapted to Pulse tokens — live in `components/ui/`
(see §8.15).

| Primitive               | State                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Button` (general)      | **`components/ui/button.tsx`** (§8.15.1). Existing inline buttons (Sidebar `+ New`, range pill, Tasks `+`, search button) not yet migrated. |
| `Input`                 | **`components/ui/input.tsx`** (§8.15.2). Auth pages still inline-styled.                                                              |
| `Label`                 | **`components/ui/label.tsx`** (§8.15.3).                                                                                              |
| `Textarea`              | **`components/ui/textarea.tsx`** (§8.15.4).                                                                                           |
| `Card`                  | **`components/ui/card.tsx`** (§8.15.5). Existing dashboard cards (Schedule / Pipeline / Inbox / Tasks / Activity / Chart) not yet migrated. |
| `Separator`             | **`components/ui/separator.tsx`** (§8.15.6).                                                                                          |
| `Badge` (general)       | **`components/ui/badge.tsx`** (§8.15.7). `PulseStatusChip` (§8.6) remains the Pulse-specific status pill.                              |
| `Dialog` / `Modal`      | **`components/ui/dialog.tsx`** (§8.15.8). Inline modals across pages (settings, payroll, scheduling) not yet migrated.                |
| `DropdownMenu`          | **`components/ui/dropdown-menu.tsx`** (§8.15.9). Sidebar new-menu still inline.                                                       |
| `Tooltip`               | **`components/ui/tooltip.tsx`** (§8.15.10). Chart hover tooltip remains inline (it's a positioned overlay, not a hover affordance).   |
| `Select`                | **`components/ui/select.tsx`** (§8.15.11).                                                                                            |
| `Checkbox`              | **`components/ui/checkbox.tsx`** (§8.15.12).                                                                                          |
| `Tabs`                  | **`components/ui/tabs.tsx`** (§8.15.13). Reports inline tabs not yet migrated.                                                        |
| `Table`                 | **`components/ui/table.tsx`** (§8.15.14). Inline `<table>` markup (§9.4) not yet migrated.                                            |
| `Stat card`             | **`CompactHeroKpi`** (§8.3). Pulse-specific.                                                                                          |
| `PageHeader`            | **`PageHeader`** (§8.2). Pulse-specific.                                                                                              |

### 8.15 shadcn/ui primitives (`components/ui/`)

Hand-authored from the canonical shadcn/ui templates and adapted to
Pulse tokens (per §10 #21). Each primitive references the bridge CSS
variables in `globals.css` (`--background`, `--primary`, …) which alias
onto our `--color-*` tokens, plus Pulse token utility classes (`bg-card`,
`text-fg`, `border-line`, …). The `hsl(var(--*))` wrappers shadcn
generates by default are **not** used — our tokens are full color
values, not HSL channels.

Style decisions overridden globally vs. shadcn defaults (per
`DESIGN_SYSTEM.md`):

- `font-medium` / `font-semibold` → `font-bold` or `font-extrabold`
  per role (§10 #1: 600 and 500 weights are not used on Pulse).
- `rounded-md` form-control radius → `rounded-xl` (§6).
- Card `rounded-xl` → `rounded-2xl` (§6 default card radius).
- Card `shadow` → no shadow (§7 cards are flat surfaces with borders).
- Tooltip `bg-primary` pill → `bg-card` border surface (§8.4 chart
  tooltip pattern).

#### 8.15.1 `Button`

Defined: `components/ui/button.tsx`. Built on `class-variance-authority`
+ `@radix-ui/react-slot`.

**Variants**: `default` (violet primary), `destructive` (red),
`outline`, `secondary`, `ghost`, `link`. **Sizes**: `default` (h-10),
`sm` (h-9), `lg` (h-11), `icon` (10×10 square).

**Canonical visual**: `default` is `h-10 px-4 py-2 rounded-xl
bg-primary text-primary-foreground font-extrabold` — matches the
Sidebar `+ New` shape (§8.1) without the inline violet glow. Apply
`shadow-glow-violet` (§7) at the call site if needed.

**Props**: extends `<button>` HTML attributes plus
`{ variant, size, asChild }`. `asChild` swaps the rendered tag for the
child element via `Slot`, so wrapping a `<Link>` keeps the styling.

#### 8.15.2 `Input`

Defined: `components/ui/input.tsx`.

**Canonical visual**: `h-10 rounded-xl border border-line-strong
bg-canvas px-3 py-2 text-sm text-fg`. The global cascade in
`globals.css` already forces `font-weight: 700` and `bg-canvas` on
unstyled inputs, so font weight isn't repeated on the class.

**Props**: extends `<input>` HTML attributes; no extras.

#### 8.15.3 `Label`

Defined: `components/ui/label.tsx`. Built on `@radix-ui/react-label`.

**Canonical visual**: `text-sm font-bold leading-none`. `font-bold`
overrides shadcn's default `font-medium` per §10 #1.

**Props**: extends `LabelPrimitive.Root` props.

#### 8.15.4 `Textarea`

Defined: `components/ui/textarea.tsx`.

**Canonical visual**: `min-h-[80px] rounded-xl border border-line-strong
bg-canvas px-3 py-2 text-sm text-fg`. Same global font/bg cascade as
`Input`.

**Props**: extends `<textarea>` HTML attributes.

#### 8.15.5 `Card`

Defined: `components/ui/card.tsx`. Exports `Card`, `CardHeader`,
`CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

**Canonical visual**: `rounded-2xl border border-line bg-card text-fg`.
No shadow (§7). The wrapper carries no padding; `CardHeader` /
`CardContent` / `CardFooter` each apply `p-6` (the §5 mid-tier card
padding). Override at the call site for `px-5 py-4` (CompactHeroKpi
tier) or `p-7` (chart hero tier).

`CardTitle` is `text-[15px] font-extrabold tracking-tight leading-none`,
matching the §4 H2 token.

**Props**: each part extends `<div>` HTML attributes.

#### 8.15.6 `Separator`

Defined: `components/ui/separator.tsx`. Built on
`@radix-ui/react-separator`.

**Canonical visual**: `bg-line` (§3), `h-[1px]` horizontal or
`w-[1px]` vertical.

**Props**: extends `SeparatorPrimitive.Root` (`orientation`,
`decorative`).

#### 8.15.7 `Badge`

Defined: `components/ui/badge.tsx`. Built on
`class-variance-authority`.

**Variants**: `default` (violet), `secondary`, `destructive`, `outline`.
**Canonical visual**: `rounded-full border px-2.5 py-1 text-[11px]
font-extrabold`. Shape and weight match `PulseStatusChip` (§8.6); this
primitive is the broader form for general-purpose accent chips.
`PulseStatusChip` remains as-is for the dashboard schedule rows.

**Props**: extends `<div>` HTML attributes plus `{ variant }`.

#### 8.15.8 `Dialog`

Defined: `components/ui/dialog.tsx`. Built on
`@radix-ui/react-dialog`. Exports `Dialog`, `DialogTrigger`,
`DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`,
`DialogDescription`, `DialogClose`, `DialogOverlay`, `DialogPortal`.

**Canonical visual**: centered card — `bg-card border border-line
shadow-menu p-6 sm:rounded-2xl max-w-lg`. Overlay `bg-black/80`.
`DialogTitle` is `text-lg font-extrabold` (§10 #1 override of
shadcn's `font-semibold`).

A dismiss button (lucide `X`) is auto-rendered in the top-right of
`DialogContent` per shadcn convention.

**Props**: each part extends the matching Radix primitive props.

#### 8.15.9 `DropdownMenu`

Defined: `components/ui/dropdown-menu.tsx`. Built on
`@radix-ui/react-dropdown-menu`. Exports the full Radix set
(`DropdownMenu`, `Trigger`, `Content`, `Item`, `CheckboxItem`,
`RadioItem`, `Label`, `Separator`, `Shortcut`, `Group`, `Sub*`).

**Canonical visual**: content surface is `rounded-xl border
border-line bg-popover shadow-menu p-1`, matching the Sidebar new-menu
container (§8.1, §7). Items are `rounded-lg px-2 py-1.5 text-sm
font-bold` with `focus:bg-accent` highlight.

**Props**: each part extends the matching Radix primitive props.
`Item`, `SubTrigger`, `Label` accept an extra `inset?: boolean` for
icon-aligned padding.

#### 8.15.10 `Tooltip`

Defined: `components/ui/tooltip.tsx`. Built on
`@radix-ui/react-tooltip`. Exports `TooltipProvider`, `Tooltip`,
`TooltipTrigger`, `TooltipContent`.

**Canonical visual**: `rounded-xl border border-line-strong bg-card
px-2.5 py-1.5 text-xs font-bold text-fg shadow-tooltip`. Mirrors the
chart hover tooltip pattern (§8.4) instead of shadcn's default
`bg-primary` pill — the Pulse vocabulary is bordered card surfaces,
not violet pills.

`TooltipProvider` must wrap the page (or a parent) for tooltips to
render.

**Props**: each part extends the matching Radix primitive props.

#### 8.15.11 `Select`

Defined: `components/ui/select.tsx`. Built on
`@radix-ui/react-select`. Exports `Select`, `SelectGroup`,
`SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`,
`SelectItem`, `SelectSeparator`, scroll buttons.

**Canonical visual**: trigger is `h-10 rounded-xl border
border-line-strong bg-canvas px-3 py-2 text-sm font-bold text-fg`
(form-control shape from §6 + §10 #1). Content surface matches
`DropdownMenu` (rounded-xl + shadow-menu + bg-popover).

**Props**: each part extends the matching Radix primitive props.

#### 8.15.12 `Checkbox`

Defined: `components/ui/checkbox.tsx`. Built on
`@radix-ui/react-checkbox`.

**Canonical visual**: `h-4 w-4 rounded-sm border border-line-strong`,
flipping to `bg-primary text-primary-foreground border-primary` when
checked. The checked-state violet matches the native `accent-color:
var(--color-violet)` rule already in `globals.css` for unstyled
checkboxes.

`rounded-sm` is not enumerated in §6 (no checkbox primitive existed
before this commit) — it's the canonical checkbox shape, retained
from shadcn defaults.

**Props**: extends `CheckboxPrimitive.Root` props.

#### 8.15.13 `Tabs`

Defined: `components/ui/tabs.tsx`. Built on `@radix-ui/react-tabs`.
Exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

**Canonical visual**: `TabsList` is `h-10 rounded-xl bg-elevated p-1`,
matching the §8.4 range-pill bar. `TabsTrigger` is `rounded-lg px-3
py-1.5 text-sm font-bold`; the active state flips to `bg-canvas
text-fg`.

**Props**: each part extends the matching Radix primitive props.

#### 8.15.14 `Table`

Defined: `components/ui/table.tsx`. Exports `Table`, `TableHeader`,
`TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`,
`TableCaption`.

**Canonical visual**: structural primitive — no inherent radius or
background. Compose inside a `Card` (§8.15.5) for the standard
rounded-2xl card surface. Row borders use `border-line` (§3); hover
state is `bg-elevated/50`. `TableHead` text is `text-fg-subtle
font-bold` (§3 muted-label role + §10 #1).

**Props**: each part extends the corresponding HTML table-element
attributes.

#### 8.15.15 `Popover`

Defined: `components/ui/popover.tsx`. Built on
`@radix-ui/react-popover`. Exports `Popover`, `PopoverTrigger`,
`PopoverAnchor`, `PopoverContent`.

**Canonical visual**: content surface is `rounded-2xl border
border-line bg-card shadow-lg p-4`. Card-tier radius (§6) rather than
the form-control `rounded-xl` because a popover reads as a floating
mini-card, not a control. `bg-card` (§3) instead of shadcn's
`bg-popover` so the surface matches the same dark `#0f0f12` fill the
rest of the app uses for surfaces.

The default `align="center"` and `sideOffset={4}` come from the
canonical shadcn template; existing call sites (e.g. the date popover
in `NewSubscriptionForm`) pass `align="start"` / `sideOffset={6}` for
better trigger alignment.

**Props**: each part extends the matching Radix primitive props.

#### 8.15.16 `Calendar`

Defined: `components/ui/calendar.tsx`. Built on `react-day-picker` v9
(no shadcn registry — react-day-picker switched its API between v8 and
v9, so this is a hand-authored wrapper that targets v9's `classNames`
keys directly).

**Canonical visual**: dark surface; weekday header is the §4 widget
label token (`text-[11px] uppercase tracking-[0.18em]
font-extrabold text-zinc-500`); day cells are `h-9 w-9 rounded-full
font-bold text-zinc-300`; selected day flips to `bg-slate-900 text-white`
matching the primary-button shape; today is outlined with the same
`outline-zinc-500` ring used for focused inputs; nav arrows are 7×7
ghost circles. The wrapper applies `p-1` so the host `PopoverContent`'s
own `p-3` (set at the call site) governs the outer padding.

**Props**: extends `DayPicker` props (`mode`, `selected`, `onSelect`,
`disabled`, `fromDate`, `toDate`, etc.). The wrapper passes through
`classNames` so a call site can override individual day-picker class
slots without losing the canonical defaults.

**Imports react-day-picker's stylesheet** (`react-day-picker/style.css`)
so the library's structural CSS (grid layout, focus rings) is applied;
all visual styling is overridden via the `classNames` prop.

### 8.16 `LineItemsSection`

Defined: `components/LineItemsSection.tsx`. The shared "Line Items"
widget used by every form that lets the user add billable line items —
`JobForm`, `NewInvoiceForm`, `NewEstimateForm`. Replaces the three
parallel inline implementations that had drifted apart visually.

**Canonical visual**: outer `Section`-style card (`bg-card border
border-line rounded-2xl p-5 sm:p-6`) with a `font-extrabold` header,
optional rose `*` required marker, and a pill `+ Add Item` action
on the right. Each line item is a `bg-card border border-line
rounded-2xl p-4` card containing, in order: title `Input`
(`rounded-full`) with a click-anywhere preset dropdown filtered
against `presets`; description `Textarea` (`rounded-2xl`) with the
violet `✦ AI Write` placeholder pill in the top-right corner; a
two-column grid of `Quantity` / `Price ($)` `Input`s (also
`rounded-full`); the `Taxable` `Checkbox`; an optional `extraRow`
slot (used by JobForm to render the conditional `Upsell` checkbox);
a trash `<svg>` ghost button on the right side; and an `Item total:
$X.XX` line right-aligned at the bottom. Underneath the list, a
`border-t border-line mt-4 pt-4` divider with a two-column
`Subtotal` / `Total` summary (label = `text-xs font-bold
text-zinc-500`, value = `tabular-nums`, total bold at `text-lg`).

**Props**:
- `items: LineItem[]` — `{ key, title, description, quantity:
  number, price_cents: number, taxable: boolean }`. `id?` is carried
  through for forms that load existing records.
- `presets: string[]` — service-name suggestions for the title
  dropdown.
- `onAdd / onChange / onRemove` — state mutators.
- `required?: boolean` — toggles the rose `*` next to the heading.
- `extraRow?: (item) => ReactNode` — host-specific extra controls
  rendered inline next to the `Taxable` checkbox.

**Helpers** exported alongside the component: `emptyLineItem(title?)`
(canonical zeroed item with a fresh `key`), `lineTotalCents(item)`,
`lineItemsSubtotal(items)`, `formatMoney(cents)`. Forms reuse these
so the math, the empty-state shape, and the formatted display all
agree across every call site.

**Policy**: this is the only line-items widget. Inline `<input>` /
`<select>` rebuilds of the same UI (the kind that drifted before
this primitive landed) are not allowed — go through
`<LineItemsSection>` and add an `extraRow` if the host has
form-specific controls.

### 8.17 `StaffPickers` (`StaffSinglePicker`, `StaffMultiPicker`)

Defined: `components/forms/StaffPickers.tsx`. The canonical pickers
for "choose one staff member" and "choose multiple staff members"
used on every form that assigns sales reps or technicians. Both
render the same Pulse pill chrome (`h-9` rounded-full container, the
caret SVG, the bg-card popover with `rounded-2xl shadow-lg`).
`StaffSinglePicker` displays the selected name with an inline `×`
clear handle; `StaffMultiPicker` renders each pick as a `bg-black
rounded-full` chip with its own `×` and a free-text filter input.

**Props (single)**: `{ staff: Staff[], id: number | null, setId:
(id: number | null) => void, placeholder: string }`.
**Props (multi)**: `{ staff: Staff[], ids: number[], setIds:
(ids: number[]) => void, placeholder: string }`.

Re-exported from `components/JobForm.tsx` for the existing
`JobDetailClient` import path. New call sites should import directly
from `components/forms/StaffPickers.tsx`.

### 8.18 `LeadSourceField`

Defined: `components/forms/LeadSourceField.tsx`. The shared "Lead
Source" control used on every customer-facing form that captures
how a job/invoice/estimate originated — `JobForm`,
`NewInvoiceForm`, `NewEstimateForm`. Replaces the three parallel
inline implementations (jobs used a `StaffSinglePicker` plus three
checkboxes, invoices and estimates used a native `<select>` with a
longer, drifted list of strings).

**Canonical visual**: a `Field`-style block with the `text-xs
font-bold text-zinc-500` "Lead Source" label, the
`StaffSinglePicker` pill underneath, and a horizontal row of three
`Checkbox` primitives — `Online`, `Direct`, `Other` — beneath the
picker. The checkboxes function as a single-select toggle group
(picking one clears the others), matching the Anytime / Schedule
later toggle pattern elsewhere on the Jobs form.

**Props**: `{ staff: Staff[], salesId: number | null, setSalesId:
(id: number | null) => void, leadMethod: string, setLeadMethod:
(m: string) => void, placeholder?: string }`.

**Constants** exported alongside the component: `LEAD_METHODS =
["Online", "Direct", "Other"] as const` and the
`LeadMethod` type alias. This is the canonical lead-method
vocabulary — the older invoice/estimate `LEAD_SOURCES` array
("Referral", "Door-to-door", "Repeat customer") has been retired in
favor of capturing the sales rep via `salesId` and the method via
this three-value set.

**Persistence**: `salesId` writes to `jobs.salesperson_id` (via
`syncAssignments`) or `invoices.sold_by_id` / `estimates.sold_by_id`;
`leadMethod` writes to the corresponding `lead_source` column.

**Policy**: this is the only Lead Source control. Inline
`<select>` rebuilds of the same UI are not allowed — go through
`<LeadSourceField>` so the three call sites stay visually and
semantically aligned.

### 8.19 `PrivateNotesSection`

Defined: `components/forms/PrivateNotesSection.tsx`. The shared
notes-with-attachments card used on the Jobs create form. Combines
the previously separate "Notes" and "Attachments" sections into a
single `Private Notes` card with a `Textarea` and a horizontal row
of two ghost dashed-border action buttons underneath: `Add
Attachment` (opens the native file picker for images and documents)
and `Add Voice Memo` (uses `MediaRecorder` to capture a webm/mp4
audio clip from the microphone). The recorder swaps in-place with a
red-bordered `Stop · M:SS` button while recording. Selected
attachments are listed below the buttons with filename, size, kind
icon, and a `×` remove handle.

**Canonical visual**: outer `Section`-style card (`bg-card border
border-line rounded-2xl p-5 sm:p-6`) with an `font-extrabold`
"Private Notes" header, the `Textarea` (`rounded-2xl`), a `mt-4
flex-wrap gap-2` button row, and an `mt-4 space-y-2` attachment
list of `border-line rounded-xl bg-black/30` rows.

**Props**: `{ notes: string, setNotes: (s: string) => void,
attachments: AttachmentDraft[], setAttachments: (next:
AttachmentDraft[]) => void }`. `AttachmentDraft` is `{ key, kind:
"image" | "file" | "audio", filename, mime_type, content
(data: URL), size }`.

**Persistence**: drafts collected client-side, then POSTed to
`/api/jobs/[id]/attachments` after the parent job has been created.
The endpoint stores the `content` data URL directly in the
`job_attachments` libSQL table (interim storage — the agreed
migration to Vercel Blob will swap the column for a remote URL
without changing this component's contract). 5 MB per-attachment
cap enforced both client-side and server-side.

**Policy**: this is the only "notes + attachments" widget. The
hand-rolled `Dropzone` component that previously sat under the
Notes section on the Jobs form has been retired. New surfaces that
need the same combo (e.g., subscriptions, leads) compose
`<PrivateNotesSection>` rather than rebuilding the textarea + file
buttons inline.

### 8.20 `MobileNavShell` + `MobileBottomNav`

Defined: `components/MobileNavShell.tsx`, `components/MobileBottomNav.tsx`.
Used: `(app)/layout.tsx`, `app/map/layout.tsx`.

The mobile-responsive shell. On viewports narrower than `md` (768px),
`PulseSidebar` becomes a slide-out drawer triggered by the "More" tab on
`MobileBottomNav`; the five most-used destinations sit in the bottom
nav. Desktop behavior is unchanged — at `md:` and up, the sidebar is
fixed-visible exactly as documented in §8.1 and the bottom nav is
hidden.

**Components:**

1. `MobileNavShell` — context provider that owns `{ open, setOpen }`.
   Wraps the entire app shell. Auto-closes on `pathname` change and
   locks `document.body.style.overflow` while open so the page behind
   doesn't scroll. Renders the dim backdrop (`bg-black/60`, z-30,
   `md:hidden`) when open; tapping the backdrop closes the drawer.

2. `MobileBottomNav` — fixed-bottom tab bar, `md:hidden`, z-30,
   `bg-sidebar` with `border-t border-divider` and bottom padding of
   `env(safe-area-inset-bottom)` so it clears the iOS home indicator.
   Five evenly-spaced tabs: **Home** (`/`), **Schedule** (`/schedule`),
   **Inbox** (`/messages` — also active on `/calls` and `/email`),
   **Map** (`/map`), and **More**. Each tab is `PulseIcon` (w-5 h-5)
   stacked over a 10px label. The "More" tab is a `<button>` (not a
   link) that toggles the drawer via `useMobileNav()`; the other four
   are `<Link>`s that close the drawer on tap. Active state pulls
   `PULSE.text` (white in dark mode); idle pulls `PULSE.textMuted`.

**Sidebar transform** — `PulseSidebar` reads `useMobileNav()` and
applies `-translate-x-full` by default plus `md:translate-x-0`
(unconditionally on desktop). When `open` is true (the "More" tab is
tapped) the mobile class flips to `translate-x-0` and the sidebar
slides in over the page. All nav links remain `<Link href>`s; route
change closes the drawer via the context's pathname effect.

**AppFrame margin** — drops the `ml-60` on mobile (`md:ml-60`), so the
main content fills the screen on phones. Centered container padding:
`px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-10
md:py-10`. The mobile bottom padding clears the bottom nav (~72px + safe
area); desktop reverts to `md:py-10`.

**`PageHeader` responsive treatment** — title is `text-[32px]` on
mobile, `text-[48px]` at `md:` and up. The `actions` slot is
`hidden md:flex` since most action buttons (e.g., the dashboard's
288px-wide search bar) don't fit on a phone. Pages that need a
primary mobile action should render it inline in the page body.

**Full-bleed pages** (`/schedule`, `/messages`, `/map`) — these opt out
of `AppFrame`'s container padding. To clear the bottom nav, the two
`h-[100dvh]` surfaces (`CalendarClient`, `MessagesClient`) shrink
their height on mobile via
`h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] md:h-[100dvh]`.
The map page lets its full-bleed map slide under the nav (the bottom
nav floats over the map surface; this matches Apple Maps / Google Maps
mobile behavior).

### 8.21 Door-knock map pins

The markers rendered on `/map` for each door-knock pin status follow a
"Flyra-style" treatment: a flat 28px filled circle in the status color,
a **filled** white (or `#0f172a` on yellow) glyph at 16px, no border,
and a soft outer glow built from layered `box-shadow` rings using the
status color at decreasing opacity.

Source: `makeMarkerElement` in
`apps/web/src/components/MapClient.tsx` reads from `PIN_STATUS` and
`filledGlyphSvg` in `apps/web/src/lib/map-pin-colors.ts`.

| Token            | Value                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Diameter         | 28px                                                                                                               |
| Background       | `PIN_STATUS[status].color`                                                                                         |
| Icon             | `filledGlyphSvg(status, textColor, 16)` — filled solid glyph (not Lucide outline)                                  |
| Icon color       | `PIN_STATUS[status].textColor` (`#fff` everywhere except `not_home` which uses `#0f172a` on the yellow background) |
| Outline          | None                                                                                                               |
| Glow             | `0 0 0 1px {c}, 0 0 12px 2px {c}cc, 0 0 24px 4px {c}55, 0 2px 4px rgba(0,0,0,0.45)` where `{c}` is the status color |

The Lucide outline icons still attached to each `PIN_STATUS` entry
remain the source for surrounding UI chrome — the icon strip
(`MapIconStrip`), drop modal (`MapPinDropModal`), and pin popup title.
Only the map markers themselves use the filled glyphs.

To add a new pin status: add a row to `PIN_STATUS` with its color/icon
plus a matching `case` in `filledGlyphSvg` returning the solid-fill
SVG markup at viewBox `0 0 24 24`.

---

## 9. Layout patterns

### 9.1 Page header

Every page composes `PageHeader` (§8.2). Dashboard call site:

```tsx
<PageHeader
  kicker={dateLabel()}
  title={`${greeting(new Date().getHours())}, ${firstName}.`}
  subtitle={`${jobs.length} jobs today · ${completedCount} completed this month`}
  actions={<SearchButton />}
/>
```

The primitive renders the standard `flex items-end justify-between
gap-4 flex-wrap mb-7` wrapper, kicker → H1 → subtitle stack, and
right-aligned `actions` slot. Pages that don't need a kicker / subtitle
omit those props.

### 9.2 Dashboard grid

Sequence on `(app)/page.tsx:31-74`:

1. **`PageHeader`** — full width (§8.2)
2. **KPI strip** — `grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5` containing 3 × `CompactHeroKpi`
3. **Chart hero** — wrapper `mb-5`, then `PulseChartHero`
4. **2-up middle row** — `grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5` containing `PulseScheduleCard` + `PulsePipelineCard`
5. **3-up bottom row** — `grid grid-cols-1 lg:grid-cols-3 gap-4` containing `PulseInboxCard` + `PulseTasksCard` + `PulseActivityCard`

Container width is enforced by the layout (`max-w-app mx-auto px-10 py-10`) — pages render content directly.

### 9.3 Card title row

Used by every widget card on the dashboard. The pattern (from `widgets.tsx:565-576`):

```tsx
<div className="flex items-baseline justify-between mb-4">
  <h2 className="text-[15px] font-extrabold tracking-tight">{title}</h2>
  {/* right-side: link OR badge OR small button */}
</div>
```

Right-side variants:
- `CardHeaderLink` (Schedule card "View all →") → §8.13
- Indicator pill ("0 unread") (Inbox card)
- Icon button (Tasks card `+`)
- `LiveBadge` (Activity card) → §8.10
- Nothing (Pipeline card)

### 9.4 Tables (off-dashboard pattern, included for completeness)

The dashboard has no tables. The closest analog inside the Pulse primitives is the **Schedule row pattern** (`widgets.tsx:472-525`) which is a flex row, not a real table. For actual tables (Customers / Reports / Leaderboard) the canonical markup is documented in code at `app/(app)/customers/page.tsx:127-180` after the post-sweep typography update; a true `<Table>` primitive does not exist.

### 9.5 Chart tooltip text color

Applies to every chart on every surface — recharts bar charts, donuts, line charts, plus any hand-rolled SVG hover tooltips (e.g. `HeroChart`).

Tooltip text is **always white** (`#fafafa`), regardless of the chart's bar / segment / line color. The chart fills stay colored (blue bars, donut segments, yellow MRR bars, etc.); only the hover text is forced to white so it's readable against the dark popover card.

Canonical recharts `<Tooltip>` config:

```tsx
<Tooltip
  contentStyle={{
    background: "#0f0f12",
    border: "1px solid #1f1f24",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    color: "#fafafa",
  }}
  labelStyle={{ color: "#fafafa", fontWeight: 800 }}
  itemStyle={{ color: "#fafafa" }}
/>
```

Both the label row (X-axis category — month, name, etc.) and the item row (Y value / series name) render in white. Do not let recharts default the item color to the bar / segment `fill`, since that produces hard-to-read colored text on the popover. The same rule applies to `MonthlyMrrChart`, `RevenueBarChart` (Top Salespeople / Top Technicians), `CountDonut` (Active Subscriptions by Template, Jobs by Lead Source), and any future chart added to the codebase.

Reference call sites: `components/ReportsClient.tsx:72-91` (bar chart), `components/ReportsClient.tsx:138-160` (donut), `components/ReportsClient.tsx:738-770` (MRR bar chart with forecast).

### 9.6 Mobile viewport lock + tab strips

**Viewport.** The root layout (`apps/web/src/app/layout.tsx`) exports a
`Viewport` with `initialScale: 1, maximumScale: 1, minimumScale: 1,
userScalable: false`. Pinch-zoom is disabled app-wide so every screen
stays sized-to-fit on mobile. Per-page `viewport` exports are not
needed and should not be added.

iOS Safari ignores the `user-scalable=no` / `maximum-scale=1` meta-tag
hints since iOS 10, so the meta-tag alone is not enough. Two
reinforcements live alongside it:

- `<MobileZoomLock />` (mounted in the root `<body>` from
  `components/MobileZoomLock.tsx`) attaches document-level
  `gesturestart` / `gesturechange` / `gestureend` listeners and a
  multi-touch `touchmove` listener that all call `preventDefault()` —
  this blocks the iOS-specific pinch gesture that the meta tag can't.
  Single-finger touchmove is left alone so page scrolling still works,
  and Mapbox handles pinch-to-zoom programmatically on its own canvas
  so map zoom is unaffected.
- `touch-action: manipulation` on the `html` element in `globals.css`
  blocks double-tap-to-zoom.

When adding a future surface that legitimately needs internal pinch
(e.g. an image viewer, another map), the surface's own JS should
process the touch events and Mapbox-style programmatically zoom its
internal view — do not remove `<MobileZoomLock />`.

**Page-level horizontal scroll is forbidden.** The shared `<main>` in
`components/AppFrame.tsx` carries `overflow-x-hidden`. No content may
escape the viewport horizontally; the whole page never side-scrolls.

**Multi-tab navs use a locally-scrollable strip — never wrap, never
clip, never collapse to a dropdown.** When a tab strip is wider than
the device, the strip itself scrolls horizontally inside its row while
the page stays put. The pattern is identical for both tab styles
documented elsewhere in §8 / §9:

- **Underline tabs** (Reports, Settings — `nav` with `border-b-2`
  buttons):

  ```tsx
  <nav className="-mb-px flex gap-6 overflow-x-auto scrollbar-none">
    {/* whitespace-nowrap on each tab button */}
  </nav>
  ```

- **Pill tabs** (Leads, Workflows, Calendar, Leaderboard, dashboard
  RevenueChart, Reports `RangePills` — `rounded-full p-1` capsule
  bars): wrap the capsule in a scrollable layer and switch the inner
  flex to `inline-flex` so the capsule keeps its natural width:

  ```tsx
  <div className="overflow-x-auto scrollbar-none max-w-full">
    <div className="bg-black rounded-full p-1 inline-flex items-center text-sm">
      {/* whitespace-nowrap on each pill */}
    </div>
  </div>
  ```

The `scrollbar-none` utility is defined once in `globals.css`
(`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) so
the scrolled tab strip has no visible scrollbar gutter — the edge-cut
trailing tab is the discovery cue, matching the native mobile pattern
(iOS Mail, Twitter, Homebase 360). Tab buttons themselves must carry
`whitespace-nowrap` so labels never wrap inside the scroll container.

**Rule for new multi-tab navs.** Any new page with more tabs than fit
on a 375px viewport uses one of the two snippets above. No dropdowns,
no `flex-wrap` to a second row of tabs, no `<select>` substitutes.
RangePills-style filter rows (e.g. `1W / 1M / 3M / YTD / Custom`) get
the pill-tab treatment too.

Reference call sites: `components/ReportsClient.tsx` (underline
tabs + `RangePills`), `components/SettingsTabs.tsx` (underline),
`components/LeadsTabs.tsx`, `components/LeadsWorkflowsClient.tsx`,
`components/CalendarClient.tsx`, `components/LeaderboardClient.tsx`,
`components/RevenueChart.tsx` (all pill).

---

## 10. Inconsistencies (resolved)

This section originally tracked 15 inconsistencies between role-similar
elements across the Pulse surfaces. **All 15 are resolved.** Rows
16–20 record subsequent token-migration work (post-audit) where
hardcoded values on the Pulse surfaces were swapped for the design
tokens already defined in `tailwind.config.ts` / `globals.css`. The
canonical decisions are reflected in §2–§9 above; this section is kept
as the changelog of those decisions and the policy for future drift.

### Scope

The canonical rules apply to **Pulse surfaces only** — the files listed
in §1. Non-Pulse pages (Calendar, Leaderboard, JobForm, EmailDetail,
Settings, etc.) keep their existing styling and will be migrated when
those pages move onto Pulse primitives.

### Resolutions

| #   | Resolution                                                                                                                                                                                                                                                                  | Reflected in     | Commit     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| 1   | `font-semibold` is not used on Pulse surfaces. The three call sites in `widgets.tsx` (schedule address, schedule technician, activity body) became `font-bold`.                                                                                                              | §4 weights       | `a6d8801`  |
| 2   | H1 subtitle is `text-sm font-bold` (was `text-[14.5px]`).                                                                                                                                                                                                                    | §4, §8.2         | `5717f15`  |
| 3   | Page-level / hero section kicker is `text-[11px] uppercase tracking-[0.22em] font-extrabold` everywhere. The chart card kicker dropped from `text-[12px]` to `text-[11px]`.                                                                                                  | §4, §8.4         | `50bfbcb`  |
| 4   | Three-tier uppercase tracking scale, locked: **0.22em** = page-level / hero kicker · **0.18em** = widget-internal label · **0.16em** = micro caps. No fourth tier.                                                                                                            | §4 tracking      | doc-only   |
| 5   | Empty-state title is `text-sm font-extrabold` (was `text-[13.5px]`).                                                                                                                                                                                                         | §4, §8.9         | `50bfbcb`  |
| 6   | Numeric values use `tabular-nums`. Added on the Compact KPI value, schedule price, and pipeline count.                                                                                                                                                                       | §4 numeric scale | `50bfbcb`  |
| 7   | Violet glow rule, locked: **16px** on full-width / pill-shaped violet primary buttons · **12px** on compact icon buttons (≤32px). No third value.                                                                                                                            | §3, §7           | doc-only   |
| 8   | Numeric weight rule, locked: `font-black tabular-nums` for hero numbers ≥ 24px (KPI value, chart headline) · `font-bold tabular-nums` for inline/row-level numbers · `font-extrabold` is **never** used on numbers.                                                          | §4 numeric scale | doc-only   |
| 9   | Sidebar idle nav row has `hover:bg-elevated` (= `PULSE.bgAlt`, `#0a0a0a`) for affordance. Active row's bg unchanged. The arbitrary form `hover:bg-[#0a0a0a]` was migrated to the token alias in #18.                                                                                | §8.1             | `50bfbcb`  |
| 10  | Primitives are generated proactively (e.g. via shadcn/ui in a separate step), not gated on per-feature need. **Policy:** any new primitive must land with a §8 sub-entry in this document in the same commit that introduces it.                                              | §8 preamble      | doc-only   |
| 11  | Generic `PageHeader` primitive extracted in `components/pulse/PageHeader.tsx`. Slots: `kicker / title / subtitle / actions`. The dashboard composes its greeting + search button at the call site. The previous dashboard-specific `PulseHeader` was removed.                | §8.2, §9.1       | `4334f57`  |
| 12  | `CardHeaderLink({ label, href })` exported from `widgets.tsx` for the canonical "View all →" affordance (`PULSE.violetSoft`, `font-extrabold`, `text-[11.5px]`).                                                                                                              | §8.13, §9.3      | `5dcc9d5`  |
| 13  | Unused tokens (`greenSoft`, `pink`, `pinkSoft`, `amber`) removed from `theme.ts`, `globals.css`, and `tailwind.config.ts`. Future warning / alert / highlight colors get a properly-named role token introduced alongside their first call site.                              | §3 accents       | `733d31b`  |
| 14  | `font-mono` is allowed only for literal code-shaped tokens (API keys, IDs, credentials). Never for prose, labels, or numbers. The single Pulse-adjacent occurrence (`app/login/page.tsx:147`, the dev-mode `admin / admin` hint) is in scope.                                  | §2               | doc-only   |
| 15  | Inter loaded via `next/font/google` in `app/layout.tsx`; CSS variable `--font-sans` overridden so the existing Tailwind `font-sans` and body cascade resolve to Inter. CLS-free with a metric-adjusted Arial fallback.                                                        | §2               | `84569f8`  |
| 16  | The five Pulse-surface shadow values are now exposed as `boxShadow` tokens (`shadow-glow-violet`, `shadow-glow-violet-sm`, `shadow-glow-green`, `shadow-menu`, `shadow-tooltip`) and applied as Tailwind utility classes. Inline `style={{ boxShadow }}` is no longer used for Sidebar `+ New`, the new-menu dropdown, the chart tooltip card, the Tasks card `+`, or the LiveBadge dot. The dynamic-value rings on the chart hover dot and activity avatar remain inline. | §3, §7, §8.4, §8.8, §8.10 | `f9ee3cc`  |
| 17  | App container width and idle sidebar nav hover both use their token aliases: `max-w-app` (= `--layout-app-max-width`, 1440px) replaces `max-w-[1440px]` in `(app)/layout.tsx`; `hover:bg-elevated` replaces `hover:bg-[#0a0a0a]` in `Sidebar.tsx`. `text-white` / `text-zinc-500` in the CallWidget became `text-fg` / `text-fg-subtle`.                                              | §3, §5, §8.1, §9.2 | `f9ee3cc`  |
| 18  | `globals.css` no longer applies a cosmetic `letter-spacing: -0.005em` to bare inputs/textareas/selects. Body cascade tracking is the canonical default; tighter tracking remains scoped to display-weight roles (H1, KPI value) via `tracking-tight`.                              | §4               | `59fd322`  |
| 19  | CallWidget (`PhoneClient.tsx`) brought onto Pulse tokens: `bg-slate-900` → `bg-card`, `shadow-2xl` → `shadow-menu`, mute idle `bg-slate-800` / `hover:bg-slate-700` → `bg-line-strong` / `hover:bg-line-strong/80`, hang-up `bg-rose-600` / `hover:bg-rose-500` → `bg-red` / `hover:bg-red/90`. The avatar chip uses the canonical accent-chip pattern (`${PULSE.green}1F` bg + `PULSE.green` text). The inline phone `<svg>` was replaced with `<PulseIcon name="phone" />`. **Mute state** no longer reads from color: both states share `bg-line-strong`; `mic` ↔ `mic-off` icons (added to `PulseIcon`, §8.11) plus the `Mute` / `Unmute` label communicate state. The hang-up button gained a `phone-off` icon (also added to §8.11) for symmetry. Override on the original audit recommendation: no amber/warning token was introduced. | §3, §8.11        | `59fd322`, `252eb22` |
| 20  | Tailwind theme cleanup: the unused compound text tokens (`text-h1`, `text-h1-hero`, `text-h1-display`, `text-h2`, `text-h3`, `text-subtitle`, `text-body`, `text-body-sm`, `text-kpi-value`, `text-kpi-value-lg`, `text-label-page`, `text-label`, `text-label-table`, `text-micro`) and the unused `rounded-card` border-radius alias were removed from `tailwind.config.ts`. None had call sites in `src/`, and a couple (h2 `lineHeight`, h3 size) had drifted from §4. The §4 arbitrary-class form remains canonical.                                                                                          | §4, §6           | `042f0b5`  |
| 21  | shadcn/ui primitives generated under `components/ui/`: `Button`, `Input`, `Label`, `Textarea`, `Card`, `Separator`, `Badge`, `Dialog`, `DropdownMenu`, `Tooltip`, `Select`, `Checkbox`, `Tabs`, `Table`. Hand-authored from canonical shadcn templates (the registry was unreachable from the sandbox); adapted to Pulse tokens with the per-primitive overrides documented in §8.15. Global overrides vs. shadcn defaults: `font-medium`/`font-semibold` → `font-bold`/`font-extrabold` per role (§10 #1); form-control `rounded-md` → `rounded-xl` (§6); Card `rounded-xl` → `rounded-2xl` and shadow dropped (§6, §7); Tooltip `bg-primary` pill → `bg-card` border surface (§8.4). Added `tailwindcss-animate` plugin so shadcn data-state animation utilities resolve. `tailwind.config.ts` gains a "shadcn bridge color aliases" block exposing `primary` / `primary-foreground` / `secondary` / `secondary-foreground` / `muted` / `muted-foreground` / `accent` / `accent-foreground` / `destructive` / `destructive-foreground` / `popover` / `popover-foreground` / `input` / `ring` as Tailwind utility classes pointing at the bridge CSS variables defined in `globals.css` — values reference `var(--*)` directly, no `hsl()` wrapper, since our tokens are full color values, not HSL channels. Existing pages not migrated; that's a separate step. | §8.14, §8.15     | `365ee30`, `e5e87b3`, `a04c16e`, `a8dedae` |
| 22  | `LeadsTabs.tsx` (the `/leads`-routed tab strip with Pipeline / Workflows / Forms / Integrations) intentionally does **not** use the shadcn `Tabs` primitive. The component is a router-link tab strip composed of `<Link>` elements driven by `usePathname()`, not a state-driven controlled tablist. Radix `Tabs` is built around an internal `value`/`onValueChange` model where `Trigger` elements update tab state inside a `Tabs.Root` wrapper. Adapting it to Next.js routing would require either (a) an `asChild` wrapper around each `<Link>` plus a sync layer to mirror `pathname` into Radix's value, or (b) abandoning the primitive's a11y plumbing entirely. Neither pays for the migration cost vs. the existing 30-line hand-rolled component. **Policy for future router-tab strips:** stay hand-rolled. The shadcn `Tabs` primitive is reserved for tab UIs whose state lives in React (panel switchers inside a single page), not URL-driven nav. | §8.14            | `de7f916`  |
| 24  | `Popover` (§8.15.15) and `Calendar` (§8.15.16) primitives added for the subscription start-date picker. `Popover` is a canonical shadcn adaptation on `@radix-ui/react-popover` with Pulse tokens (`rounded-2xl`, `bg-card`, `shadow-lg`); `Calendar` is hand-authored on `react-day-picker` v9 because the v9 API diverges from v8 enough that the shadcn registry template no longer applies cleanly. New deps: `@radix-ui/react-popover`, `react-day-picker`, `date-fns`. First call site: the start-date field on `/subscriptions/new`, where the previous `<input type="date">` was replaced to satisfy the requirement that the date can only be picked from a calendar (no typing/clearing). | §8.15.15, §8.15.16 | `97403bd` |
| 25  | `LineItemsSection` (§8.16) extracted as the canonical line-items widget. `JobForm`, `NewInvoiceForm`, and `NewEstimateForm` had three parallel inline implementations that had drifted apart visually (different input radii, different label sizes, no per-item delete on some, "Line total" rendered as a faux-input box on the invoice/estimate variants, missing `Taxable` checkbox on the simplified forms). All three now render the JobForm-style widget. Invoice/Estimate state shape unified onto `{ quantity: number, price_cents: number, taxable: boolean }` to match Job; submit payloads forward `taxable` per item. Helpers (`emptyLineItem`, `lineItemsSubtotal`, `lineTotalCents`, `formatMoney`) live alongside the component so all three forms share the same math. JobForm's job-only `Upsell` checkbox is rendered through the optional `extraRow` prop. Inline `LineItemCard`, `Total`, `money()`, and the per-form `TitleWithPresets` helpers were deleted. | §8.16            | (this commit) |
| 26  | `LeadSourceField` (§8.18) extracted as the canonical Lead Source control. `JobForm` rendered the sales-rep `StaffSinglePicker` plus an `Online`/`Direct`/`Other` checkbox toggle group; `NewInvoiceForm` and `NewEstimateForm` instead rendered a native `<select>` with a longer, drifted list of strings ("Referral", "Door-to-door", "Repeat customer", plus an overlapping "Online" / "Other"). All three now render the JobForm-style widget through `<LeadSourceField>`. The longer invoice/estimate `LEAD_SOURCES` array has been retired in favor of the three-value `LEAD_METHODS` constant exported from the primitive; the sales rep itself is now captured via `salesId` and persisted to `invoices.sold_by_id` / `estimates.sold_by_id` (the columns already existed in the schema; an `alterAddColumn` was added so existing DBs gain them). The `StaffSinglePicker` and `StaffMultiPicker` components were moved out of `JobForm.tsx` into `components/forms/StaffPickers.tsx` (§8.17) so the primitive can import them without a circular dep; `JobForm.tsx` re-exports both plus the `Staff` type for the existing `JobDetailClient` import path. | §8.17, §8.18      | (this commit) |
| 28  | Mobile viewport locked and multi-tab navs migrated to a locally-scrollable strip (§9.6). The root `Viewport` export adds `maximumScale: 1, minimumScale: 1, userScalable: false` so pinch-zoom is disabled app-wide; the shared `<main>` in `components/AppFrame.tsx` carries `overflow-x-hidden` so no page can side-scroll. A `.scrollbar-none` utility was added to `globals.css`. Every multi-tab nav was migrated to the new pattern (underline: `nav` gets `overflow-x-auto scrollbar-none` + each tab `whitespace-nowrap`; pill: the capsule is wrapped in `overflow-x-auto scrollbar-none max-w-full` and the inner `flex` becomes `inline-flex` so the capsule keeps its natural width). Call sites: `ReportsClient.tsx` (Overview/Sales/Jobs/Subscriptions/Employees/Payroll tabs + `RangePills`), `SettingsTabs.tsx` (10-section underline strip), `LeadsTabs.tsx` (router-link pills), `LeadsWorkflowsClient.tsx` (Workflows/Logs pills), `CalendarClient.tsx` (Day/Week/Month/Agenda/Map view picker), `LeaderboardClient.tsx` (Sales/Tech pills), `RevenueChart.tsx` (dashboard range pills). Recommendation Homebase-style over Flyra-style dropdown: one-tap switching, edge-cut tab as discovery cue, no new primitive needed. The per-`/reports` page-level `Viewport` export added in the earlier scorecard PR was removed since the root now covers it. | §9.6             | (this commit) |
| 27  | `PrivateNotesSection` (§8.19) extracted as the canonical "notes + attachments" widget on the Jobs create form. The form previously rendered two adjacent `Section`s: a "Notes" `Textarea` and a separate "Attachments" `Section` whose `Dropzone` was a UI placeholder with no upload backend. The two are now a single "Private Notes" card matching the invoice/estimate Private Notes naming, with the `Textarea` on top and a dashed-border `Add Attachment` / `Add Voice Memo` button row beneath. `Add Voice Memo` records via the browser `MediaRecorder` API; attachments and recordings are uploaded to a new `/api/jobs/[id]/attachments` endpoint after the parent job is created. Storage is interim: data URLs land in a new `job_attachments` libSQL table (5 MB cap per attachment, enforced both client- and server-side); the agreed migration to Vercel Blob will swap the column for a remote URL without changing the component's contract. The retired `Dropzone` placeholder was deleted. The Jobs detail page gained an `AttachmentsSection` that lists previously uploaded attachments inline (with native `<audio controls>` playback for voice memos and image thumbnails for screenshots) and exposes the same upload + record buttons for ad-hoc additions. | §8.19            | (this commit) |
| 29  | Mobile navigation switched from a floating hamburger (`MobileMenuButton`) to a fixed bottom tab bar (`MobileBottomNav`, §8.20). The hamburger overlapped page titles at the top of every mobile screen; the bottom bar removes that overlap and matches the iOS/Android native pattern. **Five tabs**, mirrored 1:1 between mobile (bottom bar) and desktop (sidebar Workspace section): Home / Schedule / Inbox / Map / More. The "More" tab opens the existing `PulseSidebar` drawer (everything in §8.1 still lives there). Messages / Calls / Email collapsed into a single **Inbox** surface routed via `InboxTabs` — a router-link pill strip matching the §10 #22 pattern, with `/messages` as the default tab. `InboxTabs` is composed inline into `MessagesClient`, `CallsClient`, and `EmailListClient` (each page's own h1/h2 swapped for an "Inbox" title + tab strip). Sidebar entries for Estimates, Invoices, and Subscriptions were removed — they were pure shortcuts to the `+ Create` dropdown, not management surfaces, so the duplication was cut; `NEW_ITEMS` in `Sidebar.tsx` still exposes all three under Create. `MobileMenuButton` was deleted from `MobileNavShell.tsx`. `AppFrame` mobile padding changed from `pt-20 pb-[calc(1rem+var(--safe-bottom))]` (top space for hamburger, safe-area bottom) to `pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))]` (no hamburger; bottom-nav clearance). Two full-bleed surfaces (`CalendarClient`, `MessagesClient`) shrink their `h-[100dvh]` to `h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] md:h-[100dvh]` so their content sits above the bottom nav; the map page lets its full-bleed map slide under the nav. | §8.1, §8.20      | (this commit) |
| 30  | Inbox header unified across `/messages`, `/calls`, `/email`. The "Inbox" `text-page-title` h1 was removed from `CallsClient.tsx` and `EmailListClient.tsx` (it never appeared on `MessagesClient.tsx` because the chat split-view is full-bleed, so the heading visibly jumped between tabs). The sidebar nav row plus the `InboxTabs` pill strip already label the surface, so the h1 was redundant. **Canonical header:** `flex items-center justify-between gap-3 flex-wrap` with `InboxTabs` left-aligned and a right-side `flex items-center gap-2 shrink-0` slot for the per-page action button (Compose icon on Messages, none on Calls, "New blast" link on Email). The right-side slot is rendered on every page — empty on Calls — so the tabs stay in the same horizontal position when switching tabs. On `MessagesClient.tsx` the header was lifted out of the conversations sidebar (`aside`) into a top bar on the outer flex-col, with `px-4 md:px-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-10 pb-4` to match the AppFrame padding the other two pages inherit. The header mirrors the aside's mobile-conversation-selected visibility (`hidden md:flex` when `selected`) so the thread still fills the viewport on mobile. | §8.20, §10 #29   | (this commit) |
| 23  | Existing surfaces migrated onto the §8.14 / §8.15 shadcn primitives across 11 batches. **Files touched (alphabetical):** `app/(app)/customers/page.tsx`, `app/(app)/employees/page.tsx`, `app/invoices/pay/[token]/PayClient.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `components/CalendarClient.tsx`, `components/CallsClient.tsx`, `components/customers/AddressFields.tsx`, `components/customers/ImportModal.tsx`, `components/EmailAutomationEditClient.tsx`, `components/EmailComposeClient.tsx`, `components/EmailDetailClient.tsx`, `components/EmailListClient.tsx`, `components/EmployeeForm.tsx`, `components/EmployeeSchedulingModal.tsx`, `components/JobDetailClient.tsx`, `components/JobForm.tsx`, `components/jobs/CustomerCard.tsx`, `components/jobs/PaymentsSection.tsx`, `components/jobs/RecordPaymentModal.tsx`, `components/LeaderboardClient.tsx`, `components/LeadsFormsClient.tsx`, `components/LeadsIntegrationsClient.tsx`, `components/LeadsPipelineClient.tsx`, `components/LeadsWorkflowsClient.tsx`, `components/MapDoorKnockSheet.tsx`, `components/MapFilterPanel.tsx`, `components/MapIconStrip.tsx`, `components/MapLassoPanel.tsx`, `components/MapPinDropModal.tsx`, `components/MapTerritoryListPanel.tsx`, `components/MapTerritoryModal.tsx`, `components/MessagesClient.tsx`, `components/NavBar.tsx`, `components/NewEstimateForm.tsx`, `components/NewInvoiceForm.tsx`, `components/NewMenu.tsx`, `components/NewSprintModal.tsx`, `components/NewSubscriptionForm.tsx`, `components/PayrollSettingsModal.tsx`, `components/PhoneClient.tsx`, `components/ReportsClient.tsx`, `components/SettingsTabs.tsx`, `components/StaffScorecardModal.tsx`. **Scope:** Native `<button>` → `Button`, `<input>` (text/email/tel/password/number/file/date/search) → `Input`, `<input type="checkbox">` → `Checkbox` (with `onChange` → `onCheckedChange` adaptation), `<textarea>` → `Textarea`, `<label>` → `Label`, `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` → `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`. `NewMenu.tsx`'s hand-rolled `+ New` dropdown rewritten using `DropdownMenu` (the only `DropdownMenu` adoption in the migration). Status chips/pills migrated to `Badge` only on `CallsClient` and `EmailListClient`; other inline status spans left as-is. Toggle-switch buttons (the slider+thumb pattern used in 8+ places) migrated to `Button variant="ghost"` with `bg-X hover:bg-X` to lock active/inactive colors against ghost's default `hover:bg-elevated`. **Cross-cutting deferred items (kept native everywhere with inline comments):** (1) all `<select>` elements — Radix `Select` forbids empty-string item values, which would break the "All" / "Select…" sentinel patterns used for clearable filter state; (2) all `<input type="radio">` — no Radio primitive in `components/ui/` yet; (3) the `Tabs` primitive — underline-style tab nav (Reports/Settings) and router-link tabs (#22) don't fit its pill model, so each tab `<button>` is a `Button variant="ghost"` swap instead; (4) the `Dialog` primitive — every `fixed inset-0` modal wrapper kept hand-rolled, only the controls inside were migrated; (5) MapDoorKnockSheet's bottom-sheet wrapper kept hand-rolled (Dialog is centered-modal only); (6) calendar/scheduling grid cells (`CalendarClient` MonthView day cells, `EmployeeSchedulingModal` per-staff per-day shift cells) kept native with their custom grid styling; (7) Pulse-adjacent dashboard widgets (`TodaySchedule`, `SprintWidget`, `RevenueChart`) and the dashboard `(app)/page.tsx` button skipped — those are domain components or already on spec; (8) `MapClient.tsx` not modified — its only `<button` matches were inside Mapbox popup `innerHTML` strings, not React JSX; (9) `<a>` / `<Link>` elements left as anchors throughout. Auth (login, signup, NavBar) and Stripe-adjacent surfaces (Settings → Payments/Subscriptions/Messaging/Calling/AI, NewInvoiceForm, NewSubscriptionForm, PayClient, PaymentsSection, RecordPaymentModal) migrated as visual-only swaps with zero changes to logic, validation, API call sites, or copy. Per-batch commits: `4196239` (Messages/Calls/Phone), `8502ded` (Email), `3ae032a` (Reports/Leaderboard/Calendar), `de7f916` (Leads), `4b6eaa6` (Map), `fdcaca2` (Customers), `65442d7` (Employees/Payroll), `5f0b787` (Auth/Misc), `d43ab99` (Settings), `7516c4d` (big forms — JobForm/NewEstimate/NewInvoice/NewSubscription/NewSprint), `0587d3a` (Jobs subfolder + JobDetail + NewMenu). | §8.14, §8.15     | (see commits in description) |

### Ongoing drift policy

When new drift appears (a one-off size, an undocumented weight, a third
glow value, a non-tabular numeric, a new uppercase tracking value),
either:

1. Bring the call site into line with the canonical rules above, or
2. If the drift represents a genuinely new role, open a PR that
   documents the new rule in §3–§9 and adds a row to §10's resolutions
   table alongside the call site change.

Don't leave a third option (silent drift). The whole point of this
document is that the second person to encounter a role doesn't have to
re-derive its styling.

---

## 11. Versioning

Changes to this document are commits. The most recent commit on the file
is the current spec. There's no separate version number — the git history
is the changelog. When the spec changes, the commit message should explain
**why** (e.g. "promote `font-semibold` cleanup; canonicalize font-bold").

---
