# Forge CRM — DESIGN_SYSTEM

> **What this is.** A factual record of the visual language currently in
> use on the Forge CRM dashboard. Every value here is taken directly from
> code, with `file:line` citations. Nothing here is aspirational — if a
> design choice isn't actually present in the dashboard, it isn't in this
> doc.
>
> **What this is NOT.** A wishlist or improvement plan. Where the code
> contains inconsistencies, they're flagged in the **"Inconsistencies"**
> section at the bottom with a proposed canonical version, but the spec
> *currently* reflects the inconsistency.
>
> **Source of truth rule.** When the code and this doc disagree, this doc
> is wrong — file an update. When two parts of the code disagree, the
> "Inconsistencies" section names the canonical version; new work follows
> that.

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

**No custom font is loaded anywhere in the production app.**

- `apps/web/src/app/layout.tsx` does not import `next/font` —
  see `apps/web/src/app/layout.tsx:1-12` (only `Metadata`, no font).
- `apps/web/tailwind.config.ts:1-9` extends nothing
  (`theme: { extend: {} }`), so no `fontFamily` override.
- `apps/web/src/app/globals.css:1-83` has no `@font-face` and no
  `font-family` on `body`.

**Effective stack** (Tailwind preflight default):
`ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
"Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`

Practically that renders as **San Francisco** on macOS / iOS, **Segoe UI**
on Windows, **Roboto** on Android, **Helvetica/Arial** as final fallback.

There is no use of `font-mono` or `font-serif` anywhere in the dashboard
or its imports. (One `font-mono` exists in `app/login/page.tsx:147` for
the `admin / admin` hint, but the dashboard doesn't use mono.)

---

## 3. Color tokens

All tokens are defined in `apps/web/src/components/pulse/theme.ts:5-28`
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
| `PULSE.violet`       | `#8b5cf6`   | theme.ts:22 | Sidebar `+ New` button (`Sidebar.tsx:129`); inline `+` buttons (`widgets.tsx:724`); pipeline gradient start (`widgets.tsx:642`); activity dot color (`widgets.tsx:768`) |
| `PULSE.violetSoft`   | `#a78bfa`   | theme.ts:23 | "View all →" link (`widgets.tsx:572`); pipeline gradient end (`widgets.tsx:642`)   |
| `PULSE.violetGlow`   | `rgba(139,92,246,0.35)` | theme.ts:24 | Glow on `+ New` (`Sidebar.tsx:131`); on inline `+` (`widgets.tsx:726`) |
| `PULSE.green`        | `#22c55e`   | theme.ts:25 | Positive delta chip bg/text (`widgets.tsx:113-114`); LiveBadge dot (`widgets.tsx:749`); first activity item (`widgets.tsx:760`) |
| `PULSE.greenSoft`    | `#4ade80`   | theme.ts:26 | (Defined but **not used** on the dashboard.)                                       |
| `PULSE.pink`         | `#ec4899`   | theme.ts:27 | (Defined but **not used** on the dashboard.)                                       |
| `PULSE.pinkSoft`     | `#f472b6`   | theme.ts:28 | (Defined but **not used** on the dashboard.)                                       |
| `PULSE.cyan`         | `#22d3ee`   | theme.ts:29 | Third activity item dot (`widgets.tsx:776`)                                        |
| `PULSE.amber`        | `#f59e0b`   | theme.ts:30 | (Defined but **not used** on the dashboard.)                                       |
| `PULSE.red`          | `#ef4444`   | theme.ts:31 | Negative delta chip bg/text (`widgets.tsx:113-114`); used in dashboard's Close rate KPI (`(app)/page.tsx:42-44`) |

### Conventions for accents

- **Tinted background, full-color text** for chips: `${color}1F` for bg
  (12% opacity), `${color}` for text. See `widgets.tsx:113-114`,
  `widgets.tsx:805-807` (activity avatar), `widgets.tsx:806`.
- **Outlined ring** for chips that need a border: `${color}33` (20% opacity)
  for the border. See `widgets.tsx:807` (activity avatar border).
- **Glow shadow** for primary CTA buttons: `0 0 16px rgba(139,92,246,0.35)`
  on full-width buttons (`Sidebar.tsx:131`), `0 0 12px ...` on icon
  buttons (`widgets.tsx:726`). Slight inconsistency — see §10.

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
| **H3 — empty-state title**   | `text-[13.5px] font-extrabold`                                                        | 13.5px / weight 800 / lh ~1.4 / tracking 0                 | `widgets.tsx:676`                           |
| **Subtitle (under H1)**      | `text-[14.5px] font-bold`                                                             | 14.5px / weight 700                                       | `widgets.tsx:60`                            |
| **Body — small subtitle**    | `text-[12px] font-bold`                                                               | 12px / weight 700                                         | `widgets.tsx:618` (Pipeline "35 active")    |
| **Body — activity item**     | `text-[12.5px] font-semibold leading-snug`                                            | 12.5px / weight 600 / lh 1.375                            | `widgets.tsx:814`                           |
| **Body — schedule row name** | `text-[14px] font-bold`                                                               | 14px / weight 700                                         | `widgets.tsx:498`                           |
| **Body — schedule row addr** | `text-[12px] font-semibold`                                                           | 12px / weight 600                                         | `widgets.tsx:501`                           |
| **Date / hero section label**| `text-[11px] uppercase tracking-[0.22em] font-extrabold`                              | 11px / weight 800 / tracking 0.22em                       | `widgets.tsx:52` (date), :425 (Revenue · Last 12 weeks) |
| **KPI label**                | `text-[11px] uppercase tracking-[0.18em] font-extrabold`                              | 11px / weight 800 / tracking 0.18em                       | `widgets.tsx:101`                           |
| **Inbox indicator label**    | `text-[10.5px] uppercase tracking-[0.18em] font-extrabold`                            | 10.5px / weight 800 / tracking 0.18em                     | `widgets.tsx:698-699`                       |
| **LiveBadge label**          | `text-[10px] uppercase tracking-[0.18em] font-bold`                                   | 10px / weight 700 / tracking 0.18em                       | `widgets.tsx:744`                           |
| **Schedule AM/PM**           | `text-[10px] font-bold tracking-[0.18em]`                                             | 10px / weight 700 / tracking 0.18em                       | `widgets.tsx:491`                           |
| **Activity item time**       | `text-[10.5px] font-bold uppercase tracking-[0.16em]`                                 | 10.5px / weight 700 / tracking 0.16em                     | `widgets.tsx:823`                           |
| **Tooltip date**             | `text-[10px] font-extrabold uppercase tracking-[0.16em]`                              | 10px / weight 800 / tracking 0.16em                       | `widgets.tsx:348`                           |
| **KPI value — chart hero**   | `text-[52px] font-black tracking-tight leading-none`                                  | 52px / weight 900                                         | `widgets.tsx:431`                           |
| **KPI value — Compact**      | `text-[26px] font-black tracking-tight leading-none`                                  | 26px / weight 900                                         | `widgets.tsx:106`                           |
| **Range pill label**         | `text-[11.5px] font-extrabold`                                                        | 11.5px / weight 800                                       | `widgets.tsx:446`                           |
| **"View all →" link**        | `text-[11.5px] font-extrabold` (color = `PULSE.violetSoft`)                          | 11.5px / weight 800                                       | `widgets.tsx:571-573`                       |
| **Sidebar nav row**          | `text-[13.5px] font-bold` (idle) / `font-extrabold` (active)                          | 13.5px                                                    | `Sidebar.tsx:226`                           |
| **Sidebar section header**   | `text-[10px] uppercase tracking-[0.2em] font-bold`                                    | 10px / weight 700 / tracking 0.2em                        | `Sidebar.tsx:169`                           |
| **Sidebar `+ New` button**   | `text-[13px] font-extrabold`                                                          | 13px / weight 800                                         | `Sidebar.tsx:127`                           |
| **Sidebar new-menu item**    | `text-[13px] font-bold`                                                               | 13px / weight 700                                         | `Sidebar.tsx:151`                           |
| **Sidebar profile name**     | `text-[12.5px] font-bold`                                                             | 12.5px / weight 700                                       | `Sidebar.tsx:203`                           |
| **Sidebar sign-out button**  | `text-[12.5px] font-bold`                                                             | 12.5px / weight 700                                       | `Sidebar.tsx:212`                           |
| **Sidebar brand name**       | `text-[15px] font-extrabold tracking-tight`                                           | 15px / weight 800                                         | `Sidebar.tsx:114`                           |
| **Schedule price column**    | `text-[14px] font-bold`                                                               | 14px / weight 700                                         | `widgets.tsx:518`                           |
| **Pipeline stage label**     | `text-[12.5px] font-bold`                                                             | 12.5px / weight 700                                       | `widgets.tsx:626`                           |
| **Pipeline count/value**     | `text-[11px] font-bold`                                                               | 11px / weight 700                                         | `widgets.tsx:628`                           |
| **Search input placeholder** | `text-[13px] font-bold` (text style on search button)                                 | 13px / weight 700                                         | `widgets.tsx:66`                            |
| **Chart axis Y label**       | `text-[11px] font-extrabold`                                                          | 11px / weight 800 / no uppercase                          | `widgets.tsx:282`                           |
| **Chart axis X label (day)** | `text-[11px] font-extrabold`                                                          | 11px / weight 800                                         | `widgets.tsx:301`                           |
| **Chart "no data" / loading**| `text-[13px] font-extrabold`                                                          | 13px / weight 800                                         | `widgets.tsx:163`                           |

### Tabular numbers

`tabular-nums` is applied in three places: chart headline (`widgets.tsx:431`),
chart tooltip value (`widgets.tsx:353`), KPI value (`widgets.tsx:106` is missing it but is used for narrative text — short %/$ — so visible drift is small). Nothing else explicitly opts in. Schedule price (`widgets.tsx:518`) and pipeline count (`widgets.tsx:628`) **lack** `tabular-nums` even though they're numeric. Flagged in §10.

### Weights actually used on the dashboard

- `font-bold` (700) — body, schedule rows, profile, sign-out, sidebar nav, view-all, "0 unread", LiveBadge label, tooltip date prefix
- `font-extrabold` (800) — every uppercase label, card titles (H2), CompactHeroKpi label, range pills, view-all, sidebar `+ New`, empty-state title, chart axis labels
- `font-black` (900) — only used on the **two big numbers** (KPI value `widgets.tsx:106` and chart headline `widgets.tsx:431`) and the chart tooltip dollar value (`widgets.tsx:353`)
- `font-semibold` (600) — used in **only three places**: schedule row address (`widgets.tsx:501`), schedule technician name (`widgets.tsx:511`), activity item body (`widgets.tsx:814`). Inconsistent; see §10.

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
the four patterns above; don't introduce new shadow values.

---

## 8. Component primitives

The dashboard imports these primitives from `components/pulse/widgets.tsx`,
`components/pulse/Sidebar.tsx`, and `components/pulse/Icon.tsx`. **There
are no separate `Button.tsx` / `Input.tsx` / `Tabs.tsx` / `Table.tsx` /
`Modal.tsx` / `Badge.tsx` files.** Existing buttons / inputs / chips on
the dashboard are inline-styled. See §10 for the gap analysis.

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

**Idle nav row** — `Sidebar.tsx:259-263`:
- Color: `PULSE.textMuted` (#a1a1aa)
- Weight: `font-bold`
- No hover state.

**Note (inconsistency):** there is no defined hover bg for nav rows.
Active rows have `bg-cardBorderHi`; idle rows on hover currently do nothing.
See §10.

### 8.2 `PulseHeader`

Defined: `widgets.tsx:39-79`. Used: `(app)/page.tsx:33-37`.

**Structure:**
- **Date label** — `widgets.tsx:51-56` — small uppercase tracked
  (`text-[11px] uppercase tracking-[0.22em] font-extrabold`,
  color `PULSE.textDim`, `mb-3`)
- **Greeting H1** — `widgets.tsx:57-59` — `text-[48px] font-extrabold tracking-tight leading-none`
- **Subtitle** — `widgets.tsx:60-62` — `text-[14.5px] mt-3 font-bold`,
  color `PULSE.textMuted`
- **Right-side button** — `widgets.tsx:64-76` — single "Search anything"
  button, h-11, rounded-2xl, bg `PULSE.bgAlt` with 1px border `PULSE.cardBorder`,
  width `w-72` (288px). **Decorative — not wired to a search**.

### 8.3 `CompactHeroKpi`

Defined: `widgets.tsx:83-121`. Used: `(app)/page.tsx:40-57`.

**Structure** (`widgets.tsx:94-120`):
- Card: `rounded-2xl px-5 py-4`, bg `PULSE.card`, border `PULSE.cardBorder`
- Layout: `flex items-center justify-between gap-4`
- **Label** (`widgets.tsx:100-105`): `text-[11px] uppercase tracking-[0.18em] font-extrabold mb-1.5`, color `PULSE.textSubtle`
- **Value** (`widgets.tsx:106-108`): `text-[26px] font-black tracking-tight leading-none`. **Missing `tabular-nums`** — see §10.
- **Delta chip** (`widgets.tsx:110-118`): `text-[11px] px-2 py-0.5 rounded-md font-extrabold`,
  bg `${color}1F`, text `${color}` where color is `PULSE.green` (positive)
  or `PULSE.red` (negative)

**Hover / focus / disabled:** none defined.

### 8.4 `PulseChartHero` + `HeroChart`

Defined: `widgets.tsx:386-468` (PulseChartHero), `widgets.tsx:147-361` (HeroChart). Used: `(app)/page.tsx:61`.

**Card** (`widgets.tsx:418-421`): `rounded-2xl p-7`, bg `PULSE.card`,
border `PULSE.cardBorder`.

**Header** (`widgets.tsx:422-457`):
- Section label (`widgets.tsx:423-429`): `text-[12px] uppercase tracking-[0.22em] font-extrabold mb-3`, color `PULSE.textSubtle`. Format: `Revenue · {titleLabel}` where `titleLabel` is one of "Last 7 days" / "This month" / "Last 3 months".
  > Note: this label is `text-[12px]`, but the date label in `PulseHeader`
  > is `text-[11px]` (both with `tracking-[0.22em]` and uppercase). Slight
  > inconsistency — see §10.
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

**Header** (`widgets.tsx:565-576`):
- H2 (`widgets.tsx:566-568`): `text-[15px] font-extrabold tracking-tight`, content "Today's schedule"
- "View all →" link (`widgets.tsx:569-575`): `text-[11.5px] font-extrabold`, color `PULSE.violetSoft`, links to `/schedule`

**Empty state** (`widgets.tsx:577-583`): `PulseEmptyState` with calendar icon, "Nothing on the calendar", "Today's jobs will appear here once scheduled."

**Row** (`PulseScheduleRow` — `widgets.tsx:472-525`):
- Container: `flex items-center gap-4 px-3 py-3 rounded-xl`, bg `PULSE.bgAlt`, 1px border `PULSE.cardBorder`
- Time block (w-12, centered): `text-[18px] font-bold leading-none` (HH:MM) over `text-[10px] font-bold tracking-[0.18em]` color `PULSE.textDim` (AM/PM)
- Customer name (flex-1, truncate): `text-[14px] font-bold`
- Customer address (truncate, optional): `text-[12px] truncate font-semibold`, color `PULSE.textSubtle` *(font-semibold here is inconsistent with the rest — see §10)*
- Status chip: see `PulseStatusChip`
- Technician (w-24, optional, hidden below `xl`): `text-[12px] font-semibold`, color `PULSE.textMuted` *(font-semibold inconsistent — see §10)*
- Price column (w-20, right): `text-[14px] font-bold`, color `PULSE.text`. **Missing `tabular-nums`** — see §10.

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
- Count + value (`widgets.tsx:627-632`): `text-[11px] font-bold`, color `PULSE.textSubtle`. **Missing `tabular-nums`**.
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
- Items (synthetic from `jobs`): up to 3, each with a 7×7 avatar circle (tinted bg `${color}1F`, color `${color}`, 1px border `${color}33`) showing the first letter, a body line `text-[12.5px] font-semibold leading-snug` *(font-semibold inconsistent — see §10)*, and an uppercase time label below `text-[10.5px] font-bold uppercase tracking-[0.16em]`.
- Empty state inline: `text-[12.5px] font-bold`, color `PULSE.textSubtle`, "No recent activity."

### 8.9 `PulseEmptyState`

Defined: `widgets.tsx:655-685`. Used by Schedule, Inbox, Tasks cards.

- Wrapper: `py-10 flex flex-col items-center text-center`
- Icon chip: `w-12 h-12 rounded-full`, bg `PULSE.bgAlt`, color `PULSE.textSubtle`, 1px border `PULSE.cardBorder`. Renders any `PulseIcon` by name.
- Title: `mt-3 text-[13.5px] font-extrabold`
- Sub: `text-[11.5px] mt-1 font-bold max-w-[20ch]`, color `PULSE.textSubtle`

### 8.10 `LiveBadge`

Defined: `widgets.tsx:741-754`.

- Layout: `flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]`
- Color: `PULSE.green`
- Dot: `w-1.5 h-1.5 rounded-full`, bg `PULSE.green`, glow `0 0 8px ${PULSE.green}`

### 8.11 `PulseIcon`

Defined: `Icon.tsx:1-43`. SVG icon set with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinecap="round"`, `strokeLinejoin="round"`. Default size `w-4 h-4`. Special case: the `plus` icon overrides `strokeWidth={2.5}`.

Available names: `home`, `calendar`, `map`, `inbox`, `doc`, `check`, `wallet`, `message`, `phone`, `mail`, `chart`, `trophy`, `user`, `users`, `settings`, `plus`, `search`, `bell`, `chevron`, `logout`, `cart`. Unknown name → empty circle (`Icon.tsx:35`).

### 8.12 What does NOT exist as a primitive

The dashboard does **not** import or use any of the following — they exist
as inline markup or do not exist at all on the dashboard:

| Primitive               | Status on dashboard                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Button` (general)      | **Inline only.** Sidebar `+ New` (`Sidebar.tsx:124-136`); search button (`widgets.tsx:65-75`); range pill (`widgets.tsx:443-454`); Tasks card `+` (`widgets.tsx:721-730`); each is hand-built. |
| `Input`                 | **Not on dashboard.** Auth pages have inline-styled inputs (`login/page.tsx:111-119`, `:125-130`); not a primitive. |
| `Select`                | **Not on dashboard.** Same — inline elsewhere.                                                              |
| `Tabs`                  | **Not on dashboard.** Reports has inline tabs (`ReportsClient.tsx:42-66`); not a primitive.                  |
| `Table`                 | **Not on dashboard.** Inline `<table>` markup elsewhere — see §9 for the table pattern.                      |
| `Dialog` / `Modal`      | **Not on dashboard.** Inline modals across pages (settings, payroll, scheduling); no primitive.              |
| `Badge`                 | **Partial.** `PulseStatusChip` (`widgets.tsx:527`) is the only badge-shaped primitive. Delta chips and "0 unread" pills are inline. |
| `Stat card`             | **Yes — `CompactHeroKpi`** (`widgets.tsx:83-121`) is the canonical KPI card.                                 |
| `PageHeader`            | **`PulseHeader`** (`widgets.tsx:39-79`) exists but is dashboard-specific (greeting wording, single search button). Not generic. |

---

## 9. Layout patterns

### 9.1 Page header

The only "page header" primitive on the dashboard is `PulseHeader` —
dashboard-specific. Its structure is:

```tsx
<div className="flex items-end justify-between gap-4 flex-wrap mb-7">
  <div>
    <div className="text-[11px] uppercase tracking-[0.22em] font-extrabold mb-3"
         style={{ color: PULSE.textDim }}>
      {/* date */}
    </div>
    <h1 className="text-[48px] font-extrabold tracking-tight leading-none">
      {/* greeting */}
    </h1>
    <p className="text-[14.5px] mt-3 font-bold"
       style={{ color: PULSE.textMuted }}>
      {/* subtitle */}
    </p>
  </div>
  <div className="flex items-center gap-2">
    {/* right-side actions */}
  </div>
</div>
```

(Pulled from `widgets.tsx:48-77`.)

### 9.2 Dashboard grid

Sequence on `(app)/page.tsx:31-74`:

1. **`PulseHeader`** — full width
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
- "View all →" link (Schedule card) → `widgets.tsx:569-575`
- Indicator pill ("0 unread") (Inbox card) → `widgets.tsx:697-702`
- Icon button (Tasks card `+`) → `widgets.tsx:721-730`
- LiveBadge (Activity card) → `widgets.tsx:789`
- Nothing (Pipeline card)

### 9.4 Tables (off-dashboard pattern, included for completeness)

The dashboard has no tables. The closest analog inside the Pulse primitives is the **Schedule row pattern** (`widgets.tsx:472-525`) which is a flex row, not a real table. For actual tables (Customers / Reports / Leaderboard) the canonical markup is documented in code at `app/(app)/customers/page.tsx:127-180` after the post-sweep typography update; a true `<Table>` primitive does not exist.

---

## 10. Inconsistencies

When the same role is styled differently across the dashboard, the
following is the proposed canonical version. New work follows the
canonical version, and existing code should be migrated as it's touched.

| # | Inconsistency                                                                                                                  | Canonical (proposed)                                                       |
| - | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1 | `font-semibold` (600) appears in 3 places only: `widgets.tsx:501`, `:511`, `:814`. Everything else is `font-bold`/`extrabold`. | Replace all three with `font-bold`. Goal: production never uses `font-semibold`. |
| 2 | Subtitle under H1 is `text-[14.5px] font-bold` (`widgets.tsx:60`). Every other subtitle in pages is `text-sm` (14px) `font-bold`. | `text-sm font-bold`. Drop the `[14.5px]` outlier.                          |
| 3 | Hero section labels use two sizes: `text-[11px]` for the date (`widgets.tsx:52`) and `text-[12px]` for chart card title (`widgets.tsx:425`). Both have the same role. | `text-[11px] uppercase tracking-[0.22em] font-extrabold` everywhere.        |
| 4 | Uppercase tracking has three values for similar roles: `0.22em` (date / chart card label), `0.18em` (KPI label / Inbox indicator / LiveBadge / AM/PM), `0.16em` (activity time / tooltip date / table headers). | **0.22em** = page-level / hero section labels. **0.18em** = KPI + form labels. **0.16em** = micro caps inside chips, table column headers, and tiny captions. |
| 5 | Empty-state title is `text-[13.5px]` (`widgets.tsx:676`) — only place that uses 13.5px.                                         | Round to `text-sm` (14px) for consistency.                                 |
| 6 | `tabular-nums` missing on numeric values: KPI value (`widgets.tsx:106`), schedule price (`widgets.tsx:518`), pipeline count (`widgets.tsx:628`). | Add `tabular-nums` to anything that's a money / count value, including KPI value. |
| 7 | Glow on `+` buttons: full-width `+ New` uses `0 0 16px violetGlow` (`Sidebar.tsx:131`), 7×7 icon `+` uses `0 0 12px violetGlow` (`widgets.tsx:726`). | **16px glow** on full-width violet buttons; **12px glow** on icon buttons. (Already differentiated, just needs to be a documented rule.) |
| 8 | KPI value weight: `font-black` is used for big numbers, but Compact KPI uses `font-black` while pipeline count / sidebar pill counts use `font-bold`. | `font-black` is reserved for "hero" numbers (big KPI value, chart headline). Smaller numeric values are `font-bold tabular-nums`. |
| 9 | Sidebar idle nav row has no hover state (`Sidebar.tsx:259-263`).                                                               | Add `hover:bg-[#0a0a0a]` (PULSE.bgAlt) on idle rows for affordance.        |
| 10 | No primitives exist for `Button`, `Input`, `Select`, `Tabs`, `Table`, `Modal`, `Badge`. Each is inline. As the app grows this drift gets worse. | Carve canonical primitives in `components/pulse/` as new pages need them. Each should land WITH a docs entry here in the same commit. |
| 11 | `PulseHeader` is dashboard-specific (greeting + single search button). No generic `<PageHeader title subtitle actions />` exists, even though every page has the same structure. | Extract a generic `PageHeader` that takes `kicker` (uppercase top label), `title`, `subtitle`, `actions` slot. Dashboard's variant becomes `<PageHeader kicker={dateLabel()} title={`${greeting}, ${firstName}.`} subtitle={...} actions={...} />`. |
| 12 | "View all →" pattern (`widgets.tsx:571-575`) is hand-coded in the Schedule card and not anywhere else. Other cards' headers vary.    | Promote it to a `CardHeaderLink` helper (`{label, href}`).                |
| 13 | `PULSE.greenSoft`, `PULSE.pink`, `PULSE.pinkSoft`, `PULSE.amber` are defined in `theme.ts:26-30` but **not used** by the dashboard. | Either remove unused tokens, or document them as "reserved for future status states" so future work knows they exist. |
| 14 | `font-mono` appears once in `app/login/page.tsx:147` for the dev hint. The dashboard never uses mono.                            | Allowed only for code-like UI hints (not body); prefer regular sans for everything user-facing. |
| 15 | No font is loaded via `next/font` — production relies on system sans (see §2). Different platforms render slightly differently.  | Decide: load Inter via `next/font/google` for cross-platform consistency, OR explicitly document the system-sans choice. Current state is undocumented drift. |

---

## 11. Versioning

Changes to this document are commits. The most recent commit on the file
is the current spec. There's no separate version number — the git history
is the changelog. When the spec changes, the commit message should explain
**why** (e.g. "promote `font-semibold` cleanup; canonicalize font-bold").

---
