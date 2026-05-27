# CLAUDE.md

Project guidance for Claude Code sessions on this repo.

## Communication style (Nick's preference — follow in every reply)

- Lead with the answer or the steps. No preamble, no recap of what was just read.
- When something needs doing, give numbered step-by-step instructions, not prose.
- Keep explanations minimal; expand only when explicitly asked.
- No multi-paragraph end-of-turn summaries.
- When telling Nick to add an environment variable, always state whether to
  mark it sensitive (secrets/keys/tokens = sensitive; plain config like a
  domain or public ID = not sensitive).

## Stack

- Next.js (App Router) + React + Tailwind in `apps/web`
- libSQL via `@libsql/client` (Turso in prod, local SQLite file in dev)
- Cookie-based HMAC auth — no OAuth / external auth services
- Stripe Connect for payments (each company connects its own Stripe account)

## Workflow

- Develop on a feature branch (`feature/*` or `claude/*`).
- Always run `npm run build` from `apps/web` before pushing — typecheck and
  Next build must both pass.
- Always commit and push the feature branch.

## Auto-merge policy

When a feature branch passes typecheck and build locally, **open a PR to
`main` and squash-merge it without asking for confirmation**. This applies
to UI changes, new pages, new API routes, new tables/columns, middleware
tweaks, shared infra, files outside `apps/web` — anything that builds.

**Always ask first** before merging if the change:

- modifies authentication, session handling, or HMAC signing
- modifies billing, Stripe, or payment flows

These two categories alone require explicit approval because the blast
radius is unrecoverable: auth bugs lock users out of prod, billing bugs
cost real money. Everything else is recoverable via a follow-up commit
or Vercel rollback, so the gate isn't worth the friction.

If unsure whether a change touches auth or billing, ask.

## Branch naming

- New features: `feature/<short-kebab-name>`
- Claude-spawned exploratory branches: `claude/<short-kebab-name>`

## After merge

- Report the merge commit SHA and PR number.
- Do not delete the feature branch automatically.

## UI Development Rules

All UI work on this repo must go through the design system documented in
`./DESIGN_SYSTEM.md` and the primitives under `apps/web/src/components/`.
These rules apply to every new page, every modification to an existing
page, and every visual bug fix.

### 1. Read the design system first

Before any UI work — building a new page, modifying an existing one,
fixing a visual bug — read `./DESIGN_SYSTEM.md`. It is the source of
truth for typography, colors, spacing, radius, shadows, and component
primitives. The canonical decisions live in §2–§9; §10 records the
resolved inconsistencies and the policy for future drift.

### 2. Use existing primitives

All buttons, inputs, selects, tabs, tables, dialogs, badges, labels,
textareas, cards, separators, dropdown menus, tooltips, and checkboxes
must use the primitives in `apps/web/src/components/ui/`. Do not write
inline `<button>` / `<input>` / etc. markup when a primitive exists.

For Pulse-surface composition, reference the canonical primitives in
`apps/web/src/components/pulse/` — `PageHeader`, `CardHeaderLink`,
`Sidebar`, the widgets in `widgets.tsx`, and `PulseIcon`. New primitives
land with a §8 sub-entry in `DESIGN_SYSTEM.md` in the same commit that
introduces them (see §10 #10).

### 3. Use design tokens

Reference design tokens for colors, font sizes, spacing, radius, and
shadows — the CSS variables defined in `globals.css` and the Tailwind
utility classes exposed in `tailwind.config.ts`. Do not hardcode hex
values, pixel sizes, or arbitrary Tailwind classes (`bg-[#…]`,
`text-[12px]`, `shadow-[0_…]`, etc.) when a token exists. If you find
yourself reaching for an arbitrary value, that's a signal to check the
token table in §3 / §4 / §5 / §6 / §7 first.

### 4. Stop and ask before inventing

If a needed pattern is not documented in `DESIGN_SYSTEM.md` and is not
available as a primitive — a new component pattern, a new color role, a
new typography variant — **stop and ask before inventing one**. Do not
silently add new tokens, new primitives, or new patterns without
explicit approval. Once approved, the new pattern must be documented in
`DESIGN_SYSTEM.md` in the same commit that introduces it. This is the
"don't leave a third option (silent drift)" rule from §10.

### 5. Document deviations

Several intentional deviations from the primitive system exist:

- Native `<select>` everywhere (Radix `Select` forbids empty-string item
  values, which would break the "All" / "Select…" sentinel patterns).
- Native `<input type="radio">` (no Radio primitive yet).
- Native `<table>` for calendar/scheduling grid cells (`CalendarClient`
  MonthView day cells, `EmployeeSchedulingModal` per-staff per-day shift
  cells).
- `MapDoorKnockSheet`'s bottom-sheet wrapper stays hand-rolled (the
  shadcn `Dialog` primitive is centered-modal only).
- `LeadsTabs.tsx` router-link tab strip stays hand-rolled (Radix `Tabs`
  is built around a controlled `value`/`onValueChange` model, not URL
  routing).
- All `fixed inset-0` modal wrappers stay hand-rolled; only the controls
  inside were migrated to primitives.

When working on those files, preserve the deviations and the inline
`{/* Native … kept: */}` comments. See `DESIGN_SYSTEM.md` §10 rows #22
and #23 for the policy.

### 6. Visual swap only on auth / Stripe surfaces

UI changes to auth surfaces (`app/login/page.tsx`, `app/signup/page.tsx`,
`components/NavBar.tsx`) and Stripe-touching surfaces (Settings →
Payments / Subscriptions / Messaging / Calling / AI, `NewInvoiceForm`,
`NewSubscriptionForm`, `components/jobs/PaymentsSection.tsx`,
`components/jobs/RecordPaymentModal.tsx`,
`app/invoices/pay/[token]/PayClient.tsx`) must be **visual primitive
swaps only** — no logic, validation, API call sites, state, or
non-styling props changed. This complements the existing auth/billing
rules in the Auto-merge policy section above: those flows still require
explicit approval before merge.
