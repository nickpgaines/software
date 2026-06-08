# FORGE — Developer Overview

> Onboarding doc for engineers joining the Forge codebase. Read this
> first, then `CLAUDE.md` (workflow rules) and `DESIGN_SYSTEM.md` (UI
> rules). Keep this file accurate — when behavior changes, update it in
> the same PR.

---

## 1. What Forge is

Forge CRM is an **all-in-one operations platform for home-service
businesses** — the single app a small-to-mid service company uses to
run sales, dispatch, billing, and customer comms. It replaces a stack
of 5–10 disconnected tools (separate CRM, scheduler, invoicing,
payments, texting, mapping, payroll) with one product purpose-built
for crews in the field.

- **Marketing site:** `forgecrm.app`
- **Owner:** NG Ventures, LLC (Myrtle Beach, SC)
- **Support:** `support@forgecrm.app`
- **Tagline:** "The CRM for service businesses that move fast."

### Target industries

Roofing, HVAC, plumbing, electrical, landscaping, pest control, window
cleaning, and adjacent home-service trades. The original seed customer
was a door-to-door window-cleaning business (see `README.md`), but the
product is designed to generalize across any field-service vertical.

### Intended uses (what end users actually do with it)

1. **Run the day.** Dispatcher opens the Schedule, drags jobs across
   crews, sees route order on the Map.
2. **Knock doors / generate leads.** Reps work the Map, drop pins,
   mark statuses, run assigned territories. Leads flow in from
   embedded web forms and Meta lead ads.
3. **Quote and close.** Rep builds an Estimate on the customer's
   doorstep, captures e-signature + SMS consent, converts to a Job.
4. **Bill and get paid.** Invoices and recurring subscriptions go out
   via Stripe — funds land in the **company's own** Stripe account
   (Stripe Connect), not the platform's.
5. **Talk to customers.** Two-way SMS + voice (Twilio) and email — all
   threaded into the Inbox.
6. **Measure performance.** Live Leaderboard ranks reps and techs;
   Reports + Scorecards drill into revenue, close rate, reviews.
7. **Pay the team.** Payroll tracking, expense tracking, equipment
   logs on the Business plan.

---

## 2. Pricing tiers (what gates what)

Source: `apps/web/src/components/marketing/PricingSection.tsx`.

| Plan         | $/mo (yearly / monthly) | Users | Headline features                                                                                                 |
| ------------ | ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| **Solo**     | $79 / $99               | 1     | Customers, Scheduling, Map, Estimates, Invoices, Stripe, SMS number + two-way texting, Reports, mobile (iOS/Android) |
| **Team** ★   | $179 / $229             | ≤ 8   | Solo + Custom roles/permissions, Leaderboard, Sales pipeline (Kanban), Recurring subscriptions, Mass marketing SMS, Dispatch notifications |
| **Business** | $279 / $379             | ≤ 30  | Team + Payroll, Equipment logs, Expense tracking, Advanced reporting, API + Zapier, Priority support              |

★ = marketed as "Most popular."

> **Note for devs:** the codebase does not currently gate features per
> plan in `apps/web/src/lib/`. The plan boundaries above are the
> marketed product; permission gating today is **per-role**, not
> per-plan (see §6).

---

## 3. Tech stack

Source: `apps/web/package.json`.

| Layer         | Choice                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| Framework     | **Next.js 14** (App Router) + React 18 + TypeScript                                   |
| Styling       | Tailwind 3 + Radix primitives (Dialog, Select, Tabs, Tooltip, etc.) + `lucide-react`  |
| DB            | **libSQL via `@libsql/client`** — Turso in prod, local SQLite file in dev. Optional embedded-replica mode for fewer WAN round-trips (`TURSO_LOCAL_REPLICA_PATH`). |
| Auth          | **Cookie-based HMAC** (`crm_session`, SHA-256). No OAuth provider. Custom signup/login. |
| Payments      | **Stripe Connect** (`stripe`, `@stripe/react-stripe-js`) — each tenant has their own connected account |
| Telephony     | **Twilio** (`twilio`, `@twilio/voice-sdk`) — SMS, voice (browser dialer), trust hub for A2P registration |
| Maps          | **Mapbox GL** + `@mapbox/mapbox-gl-draw` (territory polygons), Google Maps (`@vis.gl/react-google-maps`) for the doorknock map |
| Charts        | Recharts                                                                              |
| AI            | `@anthropic-ai/sdk` — used in `apps/web/src/lib/ai.ts` and MCP routes                  |
| Imports/CSV   | Papaparse                                                                             |
| Date logic    | date-fns                                                                              |

### Monorepo layout

```
software/
├── CLAUDE.md             # Workflow + auto-merge policy + UI rules
├── DESIGN_SYSTEM.md      # Canonical UI tokens, primitives, deviations
├── FORGE.md              # ← this file
├── README.md             # Quick local-run instructions
└── apps/
    └── web/              # The only app today (Next.js)
```

There's only one deployable app right now (`apps/web`). The monorepo
layout leaves room for a mobile app or worker process later.

---

## 4. Feature surfaces → folder map

All app routes live under `apps/web/src/app`. Two route groups:

- `app/(app)/…` — authenticated CRM surfaces (require a session)
- `app/(marketing)/…` — public homepage + marketing pages

### Authenticated surfaces (`apps/web/src/app/(app)/`)

| Surface          | Route                | Folder                                        | Notes                                                                |
| ---------------- | -------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Dashboard        | `/dashboard`         | `(app)/dashboard/`                            | KPI row + revenue hero; data fetched in `lib/dashboard.ts`           |
| Schedule         | `/schedule`          | `(app)/schedule/`, `schedule/[id]`, `new`     | Calendar + per-job detail; `CalendarClient.tsx`, `JobDetailClient.tsx` |
| Inbox — Messages | `/messages`          | `(app)/messages/`                             | Two-way SMS threads via Twilio                                       |
| Inbox — Calls    | `/calls`             | `(app)/calls/`                                | Browser dialer (`PhoneClient.tsx`), call history                     |
| Inbox — Email    | `/email`             | `(app)/email/`                                | Compose / list / detail / automation editor                          |
| Map              | `/map`               | `(app)/map/`                                  | Door-knock pins, territory drawing, lasso, status filters            |
| Leads            | `/leads`             | `(app)/leads/`, `leads/forms`, `leads/workflows`, `leads/integrations` | Pipeline (Kanban), embedded form builder, workflow editor (graph), Meta lead-ads integration |
| Reports          | `/reports`           | `(app)/reports/`                              | Revenue + sales/tech breakdowns                                      |
| Leaderboard      | `/leaderboard`       | `(app)/leaderboard/`                          | Live sales + tech rankings                                           |
| Customers        | `/customers`         | `(app)/customers/`, `customers/[id]`          | Customer list + detail, CSV import                                   |
| Employees        | `/employees`         | `(app)/employees/`, `employees/[id]`, `new`   | Team management, roles, scheduling, payroll                          |
| Settings         | `/settings`          | `(app)/settings/`, `settings/connectors`      | Org settings, integrations, Stripe/Twilio config                     |
| Estimates        | `/estimates`         | `app/estimates/`                              | Build / preview / send estimates; e-sign + SMS consent capture       |
| Invoices         | `/invoices`          | `app/invoices/`                               | One-time invoices; pay link at `invoices/pay/[token]`                |
| Subscriptions    | `/subscriptions`     | `app/subscriptions/`                          | Recurring billing; uses `lib/subscription-billing.ts`                |
| Sales/Tech stats | `/sales-stats`, `/tech-stats` | `(app)/sales-stats/`, `(app)/tech-stats/` | Per-rep scorecards                                                   |
| Platform admin   | `/admin`             | `app/admin/`                                  | NG Ventures-internal: companies list, platform-level view            |

### Public / unauthenticated surfaces (`apps/web/src/app/`)

| Route                 | Folder                          | Purpose                                            |
| --------------------- | ------------------------------- | -------------------------------------------------- |
| `/` (marketing home)  | `(marketing)/page.tsx`          | Hero, FeatureTabs, Pricing, FAQ, Final CTA         |
| `/connect-claude`     | `(marketing)/connect-claude/`   | MCP onboarding flow                                |
| `/about`              | `about/`                        | Company info + SMS program description (10DLC compliance) |
| `/terms`, `/privacy`, `/sms-terms`, `/sms-consent`, `/sms-opt-in` | `terms/`, `privacy/`, `sms-*` | Legal + carrier-required SMS disclosures |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | top-level | Auth flows |
| `/oauth/authorize`    | `oauth/`                        | OAuth grant page (for the MCP server)              |
| `/data-deletion`      | `data-deletion/`                | Meta-required user-data deletion endpoint          |
| `/design`             | `design/`                       | Internal design playground (Pulse concepts a-l)    |

### Reusable component layers (`apps/web/src/components/`)

- `ui/` — shadcn-style primitives (Button, Input, Select, Tabs, Tooltip, Dialog, etc.). **Use these.**
- `pulse/` — composition primitives for the dashboard chrome: `Sidebar`, `PageHeader`, `Icon`, `widgets.tsx`, `theme.ts`.
- `marketing/` — homepage primitives: `ForgeMark`, `MarketingNav`, `MarketingFooter`, `FeatureTabs`, `PricingSection`, `FaqSection`, `sections.tsx`.
- Per-surface clients live at the top of `components/` (e.g. `CalendarClient.tsx`, `MapClient.tsx`, `JobDetailClient.tsx`) or in surface-named folders (`components/jobs/`, `components/customers/`, etc.).

---

## 5. API routes (`apps/web/src/app/api/`)

Grouped by purpose:

- **Auth / session:** `login/`, `logout/`, `signup/`, `me/`, `auth/google`, `auth/password-reset`
- **Core CRUD:** `customers/`, `jobs/`, `estimates/`, `invoices/`, `subscriptions/`, `customer-subscriptions/`, `schedule/`, `staff/`, `roles/`, `tasks/`, `sprints/`, `territories/`, `lead-forms/`, `lead-workflows/`, `leaderboard/`, `leads/`, `reports/`, `revenue/`, `activity/`, `map/`
- **Messaging:** `messages/`, `email/`, `sms/`, `twilio/inbound-sms`, `twilio/webhooks`
- **Voice (browser dialer):** `voice/token`, `voice/inbound`, `voice/outbound`, `voice/recording`, `voice/status`, `voice/greeting`
- **Payments / Stripe:** `stripe/connect/`, `stripe/customers/`, `stripe/payment-methods/`, `stripe/terminal/`, `stripe/webhook/`, `payments/`
- **Integrations:** `integrations/meta` (Meta lead ads)
- **MCP server:** `mcp/` — exposes Forge as tools an LLM (Claude) can call; OAuth grant at `/oauth/authorize`. See `lib/mcp/auth.ts`.
- **Cron jobs:** `cron/lead-workflows`, `cron/subscription-billing`, `cron/subscription-visits`
- **Settings:** `settings/`
- **Diagnostics:** `_diagnostics/`, `diag/`

---

## 6. Auth and permissions

### Session cookie

Source: `apps/web/src/lib/auth.ts`.

- Cookie name: `crm_session`. Payload: `username:timestamp:staffId:companyId` base64url-encoded, joined by `.` to an HMAC-SHA256 signature.
- Secret: `SESSION_SECRET` env var (required in prod).
- Two token versions live in the wild: v1 (`username:ts`) and v2 (with ids). Both verify; reads degrade gracefully when the v2 fields are absent.
- **No external auth provider.** No OAuth. No Auth0/Clerk. Don't add one without explicit approval (see CLAUDE.md auto-merge policy — auth changes always require explicit approval).

### Role + permission model

Source: `apps/web/src/lib/permissions.ts`.

Three built-in roles + arbitrary custom roles per company:

| Role          | Default access                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `admin`       | Everything.                                                                                             |
| `salesperson` | Jobs, customers, schedule, own territory, sales leaderboard. **No** leads, employees, other reps' territories. |
| `technician`  | Only jobs assigned to them, tech leaderboard, messages. **No** leads, employees, map, settings.         |

Permissions are namespaced strings (`jobs.view_all`, `map.view`,
`leads.view`, `team.manage`, etc.) — see `PERMISSION_GROUPS` in
`lib/permissions.ts` for the full list. Custom roles store a `Permission[]`
override; otherwise the built-in preset applies.

### Multi-tenancy

Every authenticated row is scoped by `company_id`. The session cookie
carries `companyId`; queries filter by it. The `/admin` surface is the
NG Ventures-internal "platform admin" view across all companies.

---

## 7. Integrations (where credentials and webhooks live)

| Service        | Env vars                                                                                     | Code entry points                                                          | Webhooks                                                  |
| -------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| Turso (libSQL) | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, optional `TURSO_LOCAL_REPLICA_PATH`, `TURSO_SYNC_INTERVAL` | `lib/db.ts`                                                                | —                                                         |
| Stripe Connect | (per-tenant connected account ids in DB)                                                     | `lib/stripe.ts`, `lib/stripe-subscriptions.ts`, `lib/subscription-billing.ts` | `/api/stripe/webhook`                                     |
| Twilio (SMS)   | (per-tenant numbers in DB), trust-hub fields                                                 | `lib/sms.ts`, `lib/twilio-platform.ts`, `lib/twilio-trust-hub.ts`           | `/api/twilio/inbound-sms`, `/api/twilio/webhooks`         |
| Twilio (Voice) |                                                                                              | `lib/voice.ts`, `components/PhoneClient.tsx`                               | `/api/voice/inbound`, `/api/voice/status`, `/api/voice/recording` |
| Mapbox         | `NEXT_PUBLIC_MAPBOX_TOKEN`                                                                   | `components/MapClient.tsx`                                                 | —                                                         |
| Google Maps    | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                            | `components/MapClient.tsx`                                                 | —                                                         |
| Google OAuth   | (in `api/auth/google`)                                                                       | `api/auth/google`                                                          | —                                                         |
| Meta lead ads  | (in `api/integrations/meta`)                                                                 | `api/integrations/meta`                                                    | —                                                         |
| Anthropic      | `ANTHROPIC_API_KEY`                                                                          | `lib/ai.ts`, `lib/mcp/`                                                    | —                                                         |
| Admin bootstrap| `ADMIN_USERNAME`, `ADMIN_PASSWORD`                                                           | login flow                                                                 | —                                                         |
| Session HMAC   | `SESSION_SECRET`                                                                             | `lib/auth.ts`                                                              | —                                                         |

See `apps/web/.env.example` for the canonical list when adding new
config.

### Cron

Vercel Cron drives the routes under `api/cron/`:
- `cron/subscription-billing` — generates the next invoice for due recurring subscriptions
- `cron/subscription-visits` — auto-creates jobs for upcoming visits
- `cron/lead-workflows` — advances scheduled lead workflow nodes

---

## 8. Dev workflow

### Run locally

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

Default credentials in dev: `admin` / `admin` (set via `ADMIN_USERNAME`,
`ADMIN_PASSWORD` in `apps/web/.env`). With no Turso URL configured the
DB falls back to `apps/web/data/crm.db`.

### Before every push

```bash
cd apps/web
npm run build   # typecheck + Next build must both pass
```

Pushing without a green local build is **not** acceptable — `CLAUDE.md`
makes this explicit.

### Branching

- New features: `feature/<short-kebab-name>`
- Claude-spawned exploratory branches: `claude/<short-kebab-name>`
- Never push directly to `main`.

### Merging

`CLAUDE.md` defines an **auto-merge policy** for branches that build
green: open a PR to `main` and squash-merge **without asking**. The
two exceptions that **always** require explicit approval:

1. Auth / session / HMAC changes (lock-out risk).
2. Billing / Stripe / payment changes (real money).

When in doubt, ask.

### Hosting

- App: **Vercel** (auto-deploys on merge to `main`).
- DB: **Turso** (libSQL).
- Domain: `forgecrm.app` (marketing + app live on the same deploy).

---

## 9. UI rules (short version)

Full rules: `DESIGN_SYSTEM.md`. The non-negotiables:

1. **Read `DESIGN_SYSTEM.md` before any UI work.**
2. Use the primitives in `components/ui/` and `components/pulse/`. Do not write inline `<button>`/`<input>` when a primitive exists.
3. Use design tokens (CSS vars in `globals.css`, Tailwind utilities in `tailwind.config.ts`). No `bg-[#…]` or `text-[12px]` arbitrary values when a token covers it.
4. **Don't invent.** If a needed pattern isn't documented or available as a primitive, stop and ask. Once approved, document the new pattern in `DESIGN_SYSTEM.md` in the same commit.
5. Auth and Stripe-touching surfaces accept **visual primitive swaps only** — no logic / state / props / API changes.
6. Documented intentional deviations (preserve the `{/* Native … kept: */}` comments):
   - Native `<select>` everywhere (Radix `Select` rejects empty-string item values used for "All"/"Select…" sentinels).
   - Native `<input type="radio">` (no Radio primitive yet).
   - Native `<table>` for calendar/scheduling grid cells.
   - Hand-rolled bottom-sheet wrapper on `MapDoorKnockSheet`.
   - Hand-rolled `LeadsTabs.tsx` router-link tab strip.
   - Hand-rolled `fixed inset-0` modal wrappers (controls inside are primitive-based).

---

## 10. How to navigate when fixing or extending

1. **Where does this feature live?** Use the §4 surface-to-folder table to jump to the route. The route's `page.tsx` is server-side; the heavy client logic is in `components/<Surface>Client.tsx`.
2. **Where's the data fetched?** Look in `apps/web/src/lib/` — one file per domain (`dashboard.ts`, `jobs.ts`, `revenue.ts`, `subscription-billing.ts`, etc.). API routes are thin; the lib functions do the work.
3. **Where's the DB schema?** Migrations live inside `lib/db.ts` itself — the schema is created and migrated on first connection. There's no separate migrations folder.
4. **Permission check failing?** Open `lib/permissions.ts` and `components/pulse/Sidebar.tsx` — sidebar visibility uses the same `perm` keys as the gate.
5. **Stripe/Twilio webhook misfiring?** Start at the route in `api/stripe/webhook` or `api/twilio/webhooks`, then the matching helper in `lib/`.
6. **UI inconsistency?** Check `DESIGN_SYSTEM.md` §10 first — the drift may already be a known resolution.

---

## 11. Glossary (terms used in this codebase)

- **Pulse** — the current dashboard visual design system. Folder: `components/pulse/`. The dashboard chrome (sidebar, page header, KPI widgets) lives here.
- **Forge** — the product name. The "F" logo is `components/marketing/ForgeMark.tsx`; the same path is inlined in `pulse/Sidebar.tsx`.
- **Connect Claude** — the MCP onboarding flow (`/connect-claude`). Lets a Forge tenant authorize the MCP server so an LLM can read/write their CRM.
- **Trust Hub** — Twilio's A2P 10DLC registration flow used for SMS sender verification (`lib/twilio-trust-hub.ts`).
- **Sprints / Tasks** — internal team-task tracking inside Forge (`api/sprints/`, `api/tasks/`, `NewSprintModal.tsx`, `SprintWidget.tsx`).
- **Sales Stats / Tech Stats / Scorecards** — per-employee performance views.

---

## 12. Keeping this doc honest

When code changes meaningfully diverge from §4 (folders), §5 (API
routes), §6 (auth/permissions), §7 (integrations / env vars), or §8
(workflow): update this file in the same PR. Treat it like
`DESIGN_SYSTEM.md` — silent drift is a bug.
