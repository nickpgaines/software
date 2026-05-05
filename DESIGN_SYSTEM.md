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
| `PULSE.cardBorder` | `#1f1f24` | `border-[#1f1f24]`  | theme.ts:11 | `widgets.tsx:97` (every default card border)                |
| `PULSE.cardBorderHi` | `#2a2a32` | `border-[#2a2a32]` | theme.ts:12 | `widgets.tsx:189` (sidebar profile chip); `widgets.tsx:342` (chart tooltip border); login/signup input borders |
| `PULSE.divider`  | `#18181b`   | `bg-[#18181b]`      | theme.ts:13 | `Sidebar.tsx:107` (sidebar right border); `Sidebar.tsx:185` (sidebar top divider)            |

### Text

| Token              | Hex         | Tailwind            | Defined at  | First use                                              |
| ------------------ | ----------- | ------------------- | ----------- | ------------------------------------------------------ |
| `PULSE.text`       | `#ffffff`   | `text-white`        | theme.ts:16 | `(app)/layout.tsx:10` body text; every heading         |
| `PULSE.textMuted`  | `#a1a1aa`   | `text-zinc-400`     | theme.ts:17 | `widgets.tsx:60` (subtitle under H1)                   |
| `PULSE.textSubtle` | `#71717a`   | `text-zinc-500`     | theme.ts:18 | `widgets.tsx:69` (search button text); KPI labels      |
| `PULSE.textDim`    | `#52525b`   | `text-zinc-600`     | theme.ts:19 | `widgets.tsx:53` (date label); chart axis labels       |

### Accents (signal colors)

| Token                | Hex         | Defined at  | Use                                                                                |
| -------------------- | ----------- | ----------- | ---------------------------------------------------------------------------------- |
| `PULSE.violet`       | `#8b5cf6`   | theme.ts:41 | Sidebar `+ New` button; inline `+` buttons; pipeline gradient start; activity dot color |
| `PULSE.violetSoft`   | `#a78bfa`   | theme.ts:42 | `CardHeaderLink` ("View all →") color; pipeline gradient end                       |
| `PULSE.violetGlow`   | `rgba(139,92,246,0.35)` | theme.ts:43 | Glow on violet primary buttons (see §7 for the 16px / 12px rule)        |
| `PULSE.green`        | `#22c55e`   | theme.ts:44 | Positive delta chip bg/text; LiveBadge dot; first activity item                    |
| `PULSE.red`          | `#ef4444`   | theme.ts:45 | Negative delta chip bg/text; dashboard's Close rate KPI                            |
| `PULSE.cyan`         | `#22d3ee`   | theme.ts:46 | Third activity item dot                                                            |

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
  - **`0 0 16px ${PULSE.violetGlow}`** on full-width / pill-shaped
    buttons (e.g. Sidebar `+ New`).
  - **`0 0 12px ${PULSE.violetGlow}`** on compact icon buttons (≤32px,
    e.g. Tasks card `+`).
  - No third value. Glow size scales with button footprint.

---

## 4. Typography scale

Every value below is taken from running code. The dashboard does not use
`line-height` overrides except `leading-none` on big numbers; otherwise
`line-height` is Tailwind's default per font-size.

| Role                         | Class                                                                                 | Effective values                                          | Defined at                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| **H1 — dashboard greeting**  | `text-[48px] font-extrabold tracking-tight leading-none`                              | 48px / weight 800 / lh 1 / tracking -0.025em              | `widgets.tsx:57`                            |
| **H1 — chart card headline** | `text-[52px] font-black tracking-tight leading-none`                                  | 52px / weight 900 / lh 1 / tracking -0.025em              | `widgets.tsx:431`                           |
| **H2 — card title**          | `text-[15px] font-extrabold tracking-tight`                                           | 15px / weight 800 / lh 1.5 (default) / tracking -0.025em  | `widgets.tsx:566` (Schedule), :617 (Pipeline), :696 (Inbox), :720 (Tasks), :788 (Activity) |
| **H3 — empty-state title**   | `text-sm font-extrabold`                                                              | 14px / weight 800 / lh 1.25                               | `widgets.tsx` empty-state                   |
| **Subtitle (under H1)**      | `text-sm font-bold`                                                                   | 14px / weight 700 / lh 1.25                               | `PageHeader.tsx` subtitle slot              |
| **Body — small subtitle**    | `text-[12px] font-bold`                                                               | 12px / weight 700                                         | `widgets.tsx` Pipeline "35 active"          |
| **Body — activity item**     | `text-[12.5px] font-bold leading-snug`                                                | 12.5px / weight 700 / lh 1.375                            | `widgets.tsx` activity body                 |
| **Body — schedule row name** | `text-[14px] font-bold`                                                               | 14px / weight 700                                         | `widgets.tsx` schedule row                  |
| **Body — schedule row addr** | `text-[12px] font-bold`                                                               | 12px / weight 700                                         | `widgets.tsx` schedule row                  |
| **Page-level / hero kicker** | `text-[11px] uppercase tracking-[0.22em] font-extrabold`                              | 11px / weight 800 / tracking 0.22em                       | `PageHeader.tsx` kicker; chart card kicker  |
| **KPI label**                | `text-[11px] uppercase tracking-[0.18em] font-extrabold`                              | 11px / weight 800 / tracking 0.18em                       | `widgets.tsx:101`                           |
| **Inbox indicator label**    | `text-[10.5px] uppercase tracking-[0.18em] font-extrabold`                            | 10.5px / weight 800 / tracking 0.18em                     | `widgets.tsx:698-699`                       |
| **LiveBadge label**          | `text-[10px] uppercase tracking-[0.18em] font-bold`                                   | 10px / weight 700 / tracking 0.18em                       | `widgets.tsx:744`                           |
| **Schedule AM/PM**           | `text-[10px] font-bold tracking-[0.18em]`                                             | 10px / weight 700 / tracking 0.18em                       | `widgets.tsx:491`                           |
| **Activity item time**       | `text-[10.5px] font-bold uppercase tracking-[0.16em]`                                 | 10.5px / weight 700 / tracking 0.16em                     | `widgets.tsx:823`                           |
| **Tooltip date**             | `text-[10px] font-extrabold uppercase tracking-[0.16em]`                              | 10px / weight 800 / tracking 0.16em                       | `widgets.tsx:348`                           |
| **KPI value — chart hero**   | `text-[52px] font-black tracking-tight leading-none tabular-nums`                     | 52px / weight 900                                         | `widgets.tsx` chart headline                |
| **KPI value — Compact**      | `text-[26px] font-black tracking-tight leading-none tabular-nums`                     | 26px / weight 900                                         | `widgets.tsx` CompactHeroKpi                |
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

Three tiers, locked. No fourth value.

| Tracking  | Role                                                                          | Pairs with                                  |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| `0.22em`  | **Page-level / hero section kicker** — above an H1 or hero number             | `text-[11px] uppercase font-extrabold`      |
| `0.18em`  | **Widget-internal label** — KPI label, status indicator, badge                | `text-[10–11px] uppercase font-extrabold`   |
| `0.16em`  | **Micro caps** — chip text, table column header, tiny caption                 | `text-[10–10.5px] uppercase font-bold`      |

### Numeric weight scale

- **`font-black tabular-nums`** for "hero" numbers ≥ 24px (KPI value,
  chart headline). Big numbers earn black weight; small numbers don't.
- **`font-bold tabular-nums`** for inline / row-level numbers (prices in
  table rows, pill counts, pipeline counts).
- `font-extrabold` is reserved for headings and uppercase labels —
  **never used on numbers**.
- Anything that's a money / count value gets `tabular-nums` to prevent
  digit-width jitter on live updates.

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
| `max-w-[1440px] mx-auto px-10 py-10` | App content container — `(app)/layout.tsx:14`                    |
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

| Shadow                                                  | Element                          | Where                       |
| ------------------------------------------------------- | -------------------------------- | --------------------------- |
| `0 0 16px rgba(139,92,246,0.35)` (PULSE.violetGlow)     | Sidebar `+ New` button           | `Sidebar.tsx:131`           |
| `0 0 12px rgba(139,92,246,0.35)`                        | Tasks card inline `+` button     | `widgets.tsx:726`           |
| `0 0 8px ${PULSE.green}` (~rgba(34,197,94,1))           | LiveBadge dot                    | `widgets.tsx:749`           |
| `0 12px 28px -8px rgba(0,0,0,0.5)`                      | Sidebar new-menu dropdown        | `Sidebar.tsx:143`           |
| `0 8px 24px -8px rgba(0,0,0,0.6)`                       | Chart hover tooltip card         | `widgets.tsx:343`           |
| `0 0 0 3px PULSE.bg`                                    | Chart hover dot ring             | `widgets.tsx:328`           |
| `0 0 0 1px ${color}33` (border-style ring)              | Activity avatar (treated as ring)| `widgets.tsx:807`           |

There is **no** systematic elevation scale (e.g. `shadow-sm` / `shadow-md`).
Each shadow is hand-tuned for its widget. New work should pull from one of
the patterns above; don't introduce new shadow values. The two violet
glows are governed by the size rule in §3 (16px on full-width / pill
buttons, 12px on compact icon buttons).

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
3. Nav list — `Sidebar.tsx:162-182` — sectioned (`Workspace`, `Pipeline`, `Inbox`, `Insights`, `Team`); each section header is `Sidebar.tsx:168-173`, each row is `PulseNavRow` (`Sidebar.tsx:222-263`)
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
- Right-side icon button: 7×7 round, bg `PULSE.violet`, white plus, glow `0 0 12px ${PULSE.violetGlow}`
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
- Dot: `w-1.5 h-1.5 rounded-full`, bg `PULSE.green`, glow `0 0 8px ${PULSE.green}`

### 8.11 `PulseIcon`

Defined: `Icon.tsx:1-43`. SVG icon set with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinecap="round"`, `strokeLinejoin="round"`. Default size `w-4 h-4`. Special case: the `plus` icon overrides `strokeWidth={2.5}`.

Available names: `home`, `calendar`, `map`, `inbox`, `doc`, `check`, `wallet`, `message`, `phone`, `mail`, `chart`, `trophy`, `user`, `users`, `settings`, `plus`, `search`, `bell`, `chevron`, `logout`, `cart`. Unknown name → empty circle (`Icon.tsx:35`).

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

### 8.14 What does NOT exist as a primitive (yet)

The following primitives are **not yet** in `components/pulse/`. Per §10 #10
they will be generated proactively (e.g. via shadcn/ui in a separate
step). Until they exist, current call sites use inline markup:

| Primitive               | Current state                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Button` (general)      | **Inline only.** Sidebar `+ New`; dashboard search button; range pill; Tasks card `+`; each is hand-built.   |
| `Input`                 | **Not on dashboard.** Auth pages have inline-styled inputs.                                                   |
| `Select`                | Inline elsewhere.                                                                                            |
| `Tabs`                  | Reports has inline tabs.                                                                                     |
| `Table`                 | Inline `<table>` markup — see §9.4.                                                                          |
| `Dialog` / `Modal`      | Inline modals across pages (settings, payroll, scheduling).                                                  |
| `Badge`                 | **Partial.** `PulseStatusChip` is the only badge-shaped primitive. Delta chips and "0 unread" pills are inline. |
| `Stat card`             | **Yes — `CompactHeroKpi`** is the canonical KPI card.                                                        |
| `PageHeader`            | **Yes — `PageHeader`** (§8.2). The previous dashboard-specific `PulseHeader` was removed.                    |

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

Container width is enforced by the layout (`max-w-[1440px] mx-auto px-10 py-10`) — pages render content directly.

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

---

## 10. Inconsistencies (resolved)

This section originally tracked 15 inconsistencies between role-similar
elements across the Pulse surfaces. **All 15 are resolved.** The
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
| 9   | Sidebar idle nav row has `hover:bg-[#0a0a0a]` (`PULSE.bgAlt`) for affordance. Active row's bg unchanged.                                                                                                                                                                     | §8.1             | `50bfbcb`  |
| 10  | Primitives are generated proactively (e.g. via shadcn/ui in a separate step), not gated on per-feature need. **Policy:** any new primitive must land with a §8 sub-entry in this document in the same commit that introduces it.                                              | §8 preamble      | doc-only   |
| 11  | Generic `PageHeader` primitive extracted in `components/pulse/PageHeader.tsx`. Slots: `kicker / title / subtitle / actions`. The dashboard composes its greeting + search button at the call site. The previous dashboard-specific `PulseHeader` was removed.                | §8.2, §9.1       | `4334f57`  |
| 12  | `CardHeaderLink({ label, href })` exported from `widgets.tsx` for the canonical "View all →" affordance (`PULSE.violetSoft`, `font-extrabold`, `text-[11.5px]`).                                                                                                              | §8.13, §9.3      | `5dcc9d5`  |
| 13  | Unused tokens (`greenSoft`, `pink`, `pinkSoft`, `amber`) removed from `theme.ts`, `globals.css`, and `tailwind.config.ts`. Future warning / alert / highlight colors get a properly-named role token introduced alongside their first call site.                              | §3 accents       | `733d31b`  |
| 14  | `font-mono` is allowed only for literal code-shaped tokens (API keys, IDs, credentials). Never for prose, labels, or numbers. The single Pulse-adjacent occurrence (`app/login/page.tsx:147`, the dev-mode `admin / admin` hint) is in scope.                                  | §2               | doc-only   |
| 15  | Inter loaded via `next/font/google` in `app/layout.tsx`; CSS variable `--font-sans` overridden so the existing Tailwind `font-sans` and body cascade resolve to Inter. CLS-free with a metric-adjusted Arial fallback.                                                        | §2               | `84569f8`  |

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
