# Forge CRM — Pulse Design System

> **Single source of truth.** Every UI decision in Forge CRM should reference
> this file. Before adding new components, styling, or copy, check here first.
> When a new pattern is added or an existing one changes, this file gets
> updated in the same commit. If a screenshot ever conflicts with the spec,
> the spec wins.

## Table of contents

1. [Principles](#principles)
2. [Color tokens](#color-tokens)
3. [Typography scale](#typography-scale)
4. [Spacing, radius, borders](#spacing-radius-borders)
5. [Primitives](#primitives)
6. [Patterns](#patterns)
7. [Don't / Do](#dont--do)
8. [Where things live](#where-things-live)
9. [How to extend](#how-to-extend)

---

## Principles

The Pulse aesthetic is built around four ideas. Every styling decision
should reinforce at least one of them.

1. **Pure black canvas.** Surface = `#000`. Cards lift slightly off the
   canvas (`#0f0f12`) with subtle borders. No shadows are needed.
2. **Heavy weights, tight tracking on the bold stuff.** `font-bold` is the
   floor for body. `font-extrabold` for labels and small headings.
   `font-black` for the big numbers. Tracking is `tracking-tight` on big
   numbers and `tracking-[0.18em]`–`tracking-[0.22em]` on uppercase labels.
3. **Violet is the primary accent. Green = good, red = bad. White = command.**
   Almost everything else stays monochrome. We rarely use blue, never use
   teal/yellow except for status work.
4. **Information hierarchy is set by size + weight + uppercase, not color.**
   Section labels and KPI labels are uppercase tracked extrabold zinc-500;
   values are 26–52px font-black. Don't reach for color to fake hierarchy.

---

## Color tokens

All tokens live in `apps/web/src/components/pulse/theme.ts` as the `PULSE`
object. Use the token, not the literal hex, when you can. Literal hex in
Tailwind classes (e.g. `bg-[#0f0f12]`) is fine because Tailwind doesn't
support runtime tokens.

### Surfaces

| Token            | Hex        | Tailwind                | Use                                                 |
| ---------------- | ---------- | ----------------------- | --------------------------------------------------- |
| `bg`             | `#000000`  | `bg-black`              | App canvas, body                                    |
| `bgAlt`          | `#0a0a0a`  | `bg-[#0a0a0a]`          | Schedule rows, secondary buttons, segmented bg      |
| `card`           | `#0f0f12`  | `bg-[#0f0f12]`          | Default card surface                                |
| `cardBorder`     | `#1f1f24`  | `border-[#1f1f24]`      | Default card border, dividers, table borders       |
| `cardBorderHi`   | `#2a2a32`  | `border-[#2a2a32]`      | Input borders, profile chip                         |
| `divider`        | `#18181b`  | `bg-[#18181b]`          | Sidebar/section dividers                            |

### Text

| Token         | Hex       | Tailwind            | Use                                       |
| ------------- | --------- | ------------------- | ----------------------------------------- |
| `text`        | `#ffffff` | `text-white`        | Primary headings + body                   |
| `textMuted`   | `#a1a1aa` | `text-zinc-400`     | Subtitles, body secondary                 |
| `textSubtle`  | `#71717a` | `text-zinc-500`     | Labels, hint text, table headers          |
| `textDim`     | `#52525b` | `text-zinc-600`     | Placeholders, axis labels, disabled       |

### Accents

| Token         | Hex       | Tailwind             | Use                                                |
| ------------- | --------- | -------------------- | -------------------------------------------------- |
| `violet`      | `#8b5cf6` | `text-violet-500`    | Primary accent. + New button, "View all" links    |
| `violetSoft`  | `#a78bfa` | `text-violet-400`    | Hover, secondary violet                            |
| `green`       | `#22c55e` | `text-green-500`     | Positive deltas, paid, completed, money            |
| `red`         | `#ef4444` | `text-red-500`       | Negative deltas, errors, destructive               |
| `cyan`        | `#22d3ee` | `text-cyan-400`      | Info, optional pipeline accent                     |
| `amber`       | `#f59e0b` | `text-amber-500`     | Warnings, optional pipeline accent                 |
| `pink`        | `#ec4899` | `text-pink-500`      | Reserved (used in Pulse 2 dopamine variant only)   |

**Delta chips:** background uses the accent at 12% opacity (`${color}1F`),
text uses the accent itself.

---

## Typography scale

The default font is the system sans (Inter via Next.js default). Never use
serif or mono in production. The lab has serif/mono explorations; they're
reference only.

| Role                        | Class                                                                                | Used for                                                |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **H1 — dashboard greeting** | `text-[48px] font-extrabold tracking-tight leading-none`                             | Dashboard "Good evening, Nick."                         |
| **H1 — page heading**       | `text-[40px] font-extrabold tracking-tight leading-none text-white`                  | Every other page (Reports, Schedule, Customers, …)     |
| **H2 — section heading**    | `text-[15px] font-extrabold tracking-tight text-white`                               | Card titles ("Today's schedule", "Pipeline", "Inbox")   |
| **H3 — small heading**      | `text-[13.5px] font-extrabold text-white`                                            | Empty-state titles                                      |
| **Subtitle**                | `text-sm text-zinc-400 mt-3 font-bold`                                               | Sits under any H1                                       |
| **Date / section label**    | `text-[11px] uppercase tracking-[0.22em] font-extrabold text-zinc-500`               | "MONDAY, MAY 4", "REVENUE · LAST 12 WEEKS"             |
| **KPI / form label**        | `text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 mb-2`          | "CLOSE RATE", "ARR", form field labels                  |
| **KPI value — large**       | `text-[44px] font-black tracking-tight tabular-nums leading-none`                    | Dashboard chart headline                                |
| **KPI value — default**     | `text-[26px] font-black tracking-tight tabular-nums leading-none`                    | Reports KPI cards, dashboard CompactHeroKpi             |
| **KPI value — compact**     | `text-[22px] font-black tracking-tight tabular-nums leading-none`                    | Tight density (P21 bottom row)                          |
| **Body**                    | `text-sm text-zinc-300 font-bold` or `text-sm text-zinc-400 font-bold`               | Paragraphs, descriptions                                |
| **Small body**              | `text-[12px] font-bold text-zinc-400`                                                | Inline secondary info                                   |
| **Micro caps**              | `text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-600`                     | Sidebar section labels, AM/PM, LIVE badge               |
| **Table column header**     | `text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500`               | Every `<th>` in the app                                 |
| **Table cell**              | `text-sm font-bold text-white` (or `text-zinc-300 font-bold` for muted)              | Every `<td>`                                            |
| **Tabular numbers**         | Add `tabular-nums` to anything that's a money/count value                            | Always — keeps rows aligned                             |

**Rules:**

- **Never** use `font-medium` on something visible. Default to `font-bold`,
  step up to `font-extrabold` for labels, `font-black` for big numbers.
- **Never** use `tracking-wider` or `tracking-wide`. Always pick a specific
  bracket value: `tracking-[0.16em]` for tight uppercase, `tracking-[0.18em]`
  for KPI labels, `tracking-[0.22em]` for date/section labels, `tracking-tight`
  for large numbers.
- **Never** use `text-base` for body. It's `text-sm` or specific px sizes.

---

## Spacing, radius, borders

### Padding scale

| Class    | Use                                                                        |
| -------- | -------------------------------------------------------------------------- |
| `p-4`    | Compact KPI card (`px-5 py-4`)                                             |
| `p-5`    | Default KPI card / Reports `Stats`                                         |
| `p-6`    | Default widget card (Schedule, Inbox, Pipeline, Activity)                  |
| `p-7`    | Hero card (chart with embedded headline)                                   |

### Gap scale

| Class    | Use                                                                   |
| -------- | --------------------------------------------------------------------- |
| `gap-3`  | Tight grids (3-up small KPI cards)                                    |
| `gap-4`  | KPI strip                                                             |
| `gap-5`  | Section-to-section, 2-up widget rows                                  |

### Card radius

| Class           | Use                                                               |
| --------------- | ----------------------------------------------------------------- |
| `rounded-lg`    | Form inputs, schedule rows                                        |
| `rounded-xl`    | Schedule rows (P5/P12 variants)                                   |
| `rounded-2xl`   | **Default card.** Almost everything.                              |
| `rounded-3xl`   | Premium / "Pulse 9 — Premium" variant only                        |
| `rounded-full`  | Buttons, status pills, range pills                                |

### Borders

- Default border: `border border-[#1f1f24]`
- Input border: `border border-[#2a2a32]` (slightly higher contrast)
- Divider: `border-[#1f1f24]` for `<thead>` underlines, table row dividers
- Card → bg, `1px` solid, no shadow. Shadows are reserved for hover states
  on dropdowns: `shadow-[0_12px_28px_-8px_rgba(0,0,0,0.5)]`

### Container widths

The dashboard uses `max-w-[1440px]`. Same for every full-width page in
`(app)`. The `(app)/layout.tsx` applies it globally — page components
should NOT add their own max-width wrapper.

---

## Primitives

Each primitive lives in `apps/web/src/components/pulse/widgets.tsx` (or
adjacent files in that folder). When you need a primitive, **import it
from there.** Don't reimplement.

### Card

```tsx
<section
  className="rounded-2xl p-6"
  style={{ background: PULSE.card, border: `1px solid ${PULSE.cardBorder}` }}
>
  …
</section>
```

### Button — primary (white)

The "command" button. Used for `+ New job`, form submit (`Sign in`,
`Create account`), high-impact actions.

```tsx
<button className="h-11 rounded-2xl px-5 text-[13px] font-extrabold flex items-center gap-2"
        style={{ background: PULSE.text, color: PULSE.bg }}>
  <PulseIcon name="plus" className="w-3.5 h-3.5" />
  New job
</button>
```

### Button — violet (sidebar `+ New`, in-card `+`)

```tsx
<button className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[13px] font-extrabold transition-colors"
        style={{ background: PULSE.violet, color: "#fff",
                 boxShadow: `0 0 16px ${PULSE.violetGlow}` }}>
  <PulseIcon name="plus" className="w-3.5 h-3.5" />
  New
</button>
```

### Button — secondary (search, filter, bell)

```tsx
<button className="h-10 rounded-xl px-4 text-[13px] font-bold flex items-center gap-2"
        style={{ background: PULSE.bgAlt, color: PULSE.textSubtle,
                 border: `1px solid ${PULSE.cardBorder}` }}>
  …
</button>
```

### Input + label

Always pair an uppercase tracked label with a bg-black input. Set
`focus:ring-2 focus:ring-violet-500/50`.

```tsx
<label className="block text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 mb-2">
  Email or username
</label>
<input
  type="text"
  className="w-full bg-black border border-[#2a2a32] rounded-lg px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
/>
```

`globals.css` already forces dark inputs at the base layer for any input
that doesn't set its own bg/text. You don't have to add `bg-black text-white`
unless you also need the violet focus ring. **Always add the focus ring**
for primary inputs.

### Select + textarea

Same rules as inputs. `select` gets `color-scheme: dark` automatically via
`globals.css` so the native chevron and dropdown render dark.

### Status chip

```tsx
// "On the way" — primary
<span className="text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
      style={{ background: PULSE.text, color: PULSE.bg }}>
  On the way
</span>

// neutral status (Scheduled, Pending, etc.)
<span className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap"
      style={{ background: PULSE.bgAlt, color: PULSE.textMuted,
               border: `1px solid ${PULSE.cardBorder}` }}>
  scheduled
</span>

// signal status — green/red/violet/cyan tinted
<span className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize whitespace-nowrap"
      style={{ background: `${PULSE.green}1F`, color: PULSE.green,
               border: `1px solid ${PULSE.green}55` }}>
  completed
</span>
```

### Delta chip (KPI deltas)

```tsx
<span className="text-[11px] px-2 py-0.5 rounded-md font-extrabold tabular-nums"
      style={{ background: deltaPositive ? `${PULSE.green}1F` : `${PULSE.red}1F`,
               color: deltaPositive ? PULSE.green : PULSE.red }}>
  +12.4%
</span>
```

### CompactHeroKpi (the canonical KPI card)

Lives in `widgets.tsx`. Use it everywhere a KPI is shown. Don't reinvent.

```tsx
<CompactHeroKpi label="Close rate" value="34%" delta="−1.1%" deltaPositive={false} />
```

Renders as: ~80px tall card, uppercase label top-left, 26px black number
bottom-left, delta chip top-right.

### PulseScheduleCard

Schedule list with rows. Pass `jobs` and optional `rows` count.

```tsx
<PulseScheduleCard jobs={jobs} rows={5} />
```

### PulseChartHero

The big revenue chart with embedded headline + interactive 7D/1M/3M toggle
+ hover tooltip. Self-fetches from `/api/revenue`.

```tsx
<PulseChartHero />              // default 1m
<PulseChartHero initialRange="1w" height={260} />
```

### PulseHeader

Page header with date, greeting, subtitle, and right-side action buttons.

```tsx
<PulseHeader firstName={firstName} jobs={jobs} completedCount={completedCount} />
```

### PulseInboxCard / PulseTasksCard / PulsePipelineCard / PulseActivityCard

Drop-in widgets that match the dashboard exactly. Import and use.

### PulseEmptyState

```tsx
<PulseEmptyState iconName="message"
                 title="No recent conversations"
                 sub="New conversations will appear here." />
```

---

## Patterns

### Page header

Every page in `(app)` opens with this structure:

```tsx
<div className="flex items-end justify-between gap-4 flex-wrap mb-7">
  <div>
    <div className="text-[11px] uppercase tracking-[0.22em] font-extrabold mb-3 text-zinc-600">
      MONDAY, MAY 4
    </div>
    <h1 className="text-[40px] font-extrabold tracking-tight leading-none text-white">
      Page Title
    </h1>
    <p className="text-sm text-zinc-400 mt-3 font-bold">
      Subtitle that explains what's on this page.
    </p>
  </div>
  <div className="flex items-center gap-2">
    {/* search button + primary action */}
  </div>
</div>
```

The `PulseHeader` component handles the dashboard variant. For non-dashboard
pages, write the header inline using the spec above. (We can extract a
shared `PageHeader` later — it's not done yet because each page differs in
the right-side actions.)

### KPI strip

Three or four `CompactHeroKpi` cards in a grid:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
  <CompactHeroKpi label="…" value="…" delta="…" deltaPositive />
  <CompactHeroKpi label="…" value="…" delta="…" deltaPositive />
  <CompactHeroKpi label="…" value="…" delta="…" deltaPositive={false} />
</div>
```

### Section + uppercase divider

Used in Reports to label Revenue / Jobs / Customers groups:

```tsx
<section className="mb-8">
  <div className="flex items-center gap-3 mb-3">
    <h3 className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500">
      Revenue
    </h3>
    <span className="h-px flex-1 bg-zinc-800" />
  </div>
  …
</section>
```

### Table

```tsx
<table className="w-full text-sm">
  <thead className="bg-black border-b border-[#1f1f24]">
    <tr>
      <th className="text-left px-5 py-3 text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-500">
        Name
      </th>
      …
    </tr>
  </thead>
  <tbody className="divide-y divide-[#1f1f24]">
    <tr>
      <td className="px-5 py-3 font-bold text-white">Aaron Lopresti</td>
      <td className="px-5 py-3 text-zinc-300 font-bold">…</td>
      …
    </tr>
  </tbody>
</table>
```

Action buttons in the right-most column use the **micro action label**
style:

```tsx
<button className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-emerald-400 hover:text-emerald-300 mr-4">
  Call
</button>
```

---

## Don't / Do

| ❌ Don't                                            | ✅ Do                                                        |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `font-medium` on visible UI                         | `font-bold` minimum                                          |
| `text-base` for body                                | `text-sm` (or specific px size)                              |
| `bg-white` for any production surface              | `bg-[#0f0f12]` (card) or `bg-black` (canvas)                 |
| `text-slate-*` (light theme leftover)              | `text-zinc-*` or `text-white`                                |
| `bg-slate-900` for primary buttons (invisible)     | `bg-white text-black` for primary, `bg-violet` for accent   |
| `tracking-wider` / `tracking-wide`                 | Specific bracket: `tracking-[0.16em]` etc.                   |
| Reinventing a KPI card                             | `<CompactHeroKpi />`                                         |
| Reinventing the chart                              | `<PulseChartHero />` or `<HeroChart days={…} />`             |
| New brand colors                                   | Use `violet` / `green` / `red` from `PULSE`                  |
| Adding shadows for depth                           | Lift via lighter `bg` (`#0f0f12` over `#000`)                |
| Light mode anywhere in the live app                | Dark only. Lab `/design` may explore light, prod is dark.    |
| Per-page max-width wrappers                        | Layout owns max-w-[1440px], pages render directly inside    |
| Mixing serif or mono fonts                         | System sans only in production                               |

---

## Where things live

```
apps/web/src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx          ← Pulse sidebar + dark canvas + max-w-[1440px]
│   │   └── page.tsx            ← Dashboard, the canonical reference page
│   ├── globals.css             ← html/body dark, base input forcing, autofill override
│   ├── layout.tsx              ← Root layout (metadata, html shell)
│   ├── login/page.tsx          ← Pulse-styled auth (label-input pattern reference)
│   └── design/                 ← Lab. Sandbox only. Don't import from here in production.
├── components/
│   └── pulse/
│       ├── theme.ts            ← PULSE color tokens
│       ├── format.ts           ← formatCents / formatTime / etc. (server-callable)
│       ├── types.ts            ← LiveJob / RevenueSummary / etc.
│       ├── Icon.tsx            ← PulseIcon — every icon used in production
│       ├── Sidebar.tsx         ← PulseSidebar (live nav, auth, +New menu, sign out)
│       └── widgets.tsx         ← Every other primitive: cards, KPIs, chart, schedule, etc.
└── lib/
    └── dashboard.ts            ← Server data fetchers (getDashboardIdentity etc.)
```

The dashboard page (`(app)/page.tsx`) is the **reference implementation**.
When in doubt about how something should look, open the dashboard, find
the closest analog, and copy the pattern.

---

## How to extend

### When you need to ship a new pattern

1. Check this file. Is there an existing primitive or pattern that fits?
   If yes, use it. Don't reinvent.
2. If not, look at the dashboard. Is there a structural cousin you can
   adapt?
3. If still nothing fits, build the new pattern, **then update this doc**
   in the same PR. Add it under Primitives or Patterns with the canonical
   markup, the rule for when to use it, and the file location.

### When you need to add a new color

Almost never. The accent palette is closed (violet / green / red / cyan /
amber). If you genuinely need a new accent, add it to `PULSE` in
`theme.ts`, document it under "Accents" above with its use-case, and only
then use it.

### When you need to redesign a whole page

Don't redesign in the live app. Spin up variants under `app/design/` first,
iterate visually, lock in the chosen direction, then promote the design
into the live app. The dashboard, Reports, and the Pulse 21 lock-in all
followed this pattern.

### When you need to update an existing primitive

Update the primitive itself in `components/pulse/widgets.tsx` (or the
appropriate file). Every consumer picks up the change automatically. If
the change has a behavior or sizing implication, update this doc too.

---

## Versioning

Changes to this document are commits. The most recent commit on the file
is the current spec. There's no separate version number — the git history
is the changelog.

When the spec changes, the description should explain **why** the change
was made (e.g. "default card padding bumped from p-5 to p-6 because
content felt cramped after Reports KPI shrink").

---
