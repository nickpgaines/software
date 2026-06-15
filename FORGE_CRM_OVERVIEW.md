# Forge CRM — Software Overview

> Onboarding context for developers. This is the "what it is, what it has, how it
> works" map — not a spec. For UI rules see `DESIGN_SYSTEM.md`; for workflow/branch
> rules see `CLAUDE.md`.

---

## 1. What it is

**Forge CRM is an all-in-one operating system for field-service businesses** —
window cleaning, HVAC, plumbing, pest control, and similar crews that dispatch
people to customer addresses. It replaces the usual stack of separate tools
(scheduling app + QuickBooks + a texting service + a payroll spreadsheet + a
lead form) with one platform.

- **Who it's for:** home-service contractors and their field crews.
- **The goal:** run the entire job lifecycle in one place — capture a lead →
  send an estimate → schedule the job → do the work → invoice & collect payment →
  set up recurring service → pay the crew → measure performance.
- **Positioning:** "The CRM for service businesses that move fast. Scheduling,
  mapping, invoicing, payroll, and recurring billing — one platform."
- **Model:** Multi-tenant SaaS. Each business ("company") is an isolated tenant;
  every tenant connects its **own** Stripe account so money flows directly to it.

---

## 2. Tech stack (at a glance)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling/UI | Tailwind + Radix primitives + in-house "Pulse" design system |
| Database | libSQL — **Turso** in prod, local SQLite file in dev (`@libsql/client`) |
| Auth | Cookie-based **HMAC** session token (no external auth service); optional Google OAuth |
| Payments | **Stripe Connect** (per-tenant accounts) |
| SMS / Voice | **Twilio** (A2P 10DLC, browser VoIP) |
| Email | **Resend** |
| AI | **Anthropic Claude** (`claude-sonnet-4-6`) |
| Maps | **Mapbox** + Google Maps |
| Leads | **Meta (Facebook/Instagram) Lead Ads** |
| Host | Vercel |

**Repo layout** is a thin monorepo — effectively one app:

```
/software
├── CLAUDE.md            # dev workflow + auto-merge policy
├── DESIGN_SYSTEM.md     # UI source of truth
└── apps/web             # the entire product (Next.js)
    └── src
        ├── app          # pages (App Router) + /api routes
        ├── components   # ui/ (Radix), pulse/ (design system), feature components
        └── lib          # db.ts, auth.ts, and per-integration modules
```

The database has **no migration files** — `lib/db.ts` defines the schema inline
and self-migrates on cold start, gated by a `SCHEMA_VERSION` marker (currently 16).

---

## 3. How auth & multi-tenancy work

- **Session:** a `crm_session` httpOnly cookie holding
  `base64url(username:timestamp:staffId:companyId).HMAC-SHA256`. Signed with
  `SESSION_SECRET`, verified with timing-safe comparison. 30-day expiry.
- **Tenant isolation:** nearly every table carries a `company_id`. API routes call
  `requireCompanyId()` to pull the tenant from the session and scope every query.
- **Roles:** built-in `permission_level` of `admin | salesperson | technician`,
  plus optional **custom roles** with a JSON permission array. Navigation and
  pages are gated by permission keys (`schedule.view`, `leads.view`, `team.manage`, etc.).
- **Platform admin:** a superuser (`ADMIN_USERNAME`) sees the `/admin` console
  across all companies.

---

## 4. The sections (what each part is for)

The authenticated app lives under the `(app)` route group with a sidebar grouped
into **Workspace / Insights / Team**. Public marketing + auth + customer-facing
payment pages live outside it.

### Workspace
| Section | Route | Purpose |
|---|---|---|
| **Dashboard** | `/dashboard` | Role-aware home: KPIs, sales charts, today's schedule, inbox, tasks, activity feed. |
| **Schedule** | `/schedule` | Calendar of jobs; create/edit/assign jobs to crew. The operational core. |
| **Inbox** | `/messages`, `/calls`, `/email` | Unified comms — SMS threads, call log, and email, per customer. |
| **Map** | `/map` | Geographic view of customers + door-knock/canvassing pins and territories. |
| **Leads** | `/leads` | Kanban sales pipeline. Sub-pages for capture **forms**, automation **workflows**, and **Meta** lead integration. |

### Insights
| Section | Route | Purpose |
|---|---|---|
| **Reports** | `/reports` | Revenue, jobs, sales, payroll, and subscription analytics. |
| **Leaderboard** | `/leaderboard` | Sales/tech rankings; gamified with "sprints" (timed competitions + prizes). |

### Team
| Section | Route | Purpose |
|---|---|---|
| **Customers** | `/customers` | Master customer database + history; CSV bulk import. |
| **Employees** | `/employees` | Manage staff, roles, permissions, commission rates, shifts. |
| **Settings** | `/settings` | Company profile, billing, **integration setup** (Stripe/Twilio/email/AI), and the Claude/MCP connector. |

### Financial flows (reached via the "Create" menu and detail pages)
- **Estimates** — quotes with line items, digital signature, public accept link.
- **Invoices** — billing docs with line items; public pay link; partial payments.
- **Subscriptions** — recurring service plans (templates → per-customer subscriptions) with auto-billing.

### Customer-facing public pages (no login, token-secured)
- `/estimates/accept/[token]` — customer signs/accepts an estimate.
- `/invoices/pay/[token]` — customer pays an invoice.
- `/subscriptions/accept/[token]` — customer accepts + saves a card for a plan.

---

## 5. The data model (mental model)

~60 tables, all tenant-scoped. The spine:

```
company
 ├─ staff (roles, commission rates)  ── custom_roles
 ├─ customers
 │   ├─ jobs ── job_assignments, line_items, checklist_items, attachments
 │   ├─ estimates ── estimate_items
 │   ├─ invoices ── invoice_items
 │   ├─ customer_subscriptions ── subscription_charge_attempts
 │   ├─ messages / calls            (Twilio comms history)
 │   └─ map_pins
 ├─ leads ── lead_workflows / lead_workflow_runs / lead_tasks / lead_forms
 ├─ payments                        (job or subscription, via Stripe)
 ├─ subscription_templates / subscription_terms
 ├─ email_blasts / email_recipients / email_automations
 ├─ territories, sprints / sprint_prizes
 ├─ payroll_settings, staff_shifts, payroll_payouts
 ├─ activity_events                 (append-only audit/feed)
 └─ settings singletons: messaging_/email_/ai_/customization_/payroll_settings
```

Key lifecycle status enums:
- **Lead stage:** `new → contacted → responded → estimate_sent`
- **Estimate:** `draft → sent → accepted/declined/expired`
- **Job:** `scheduled → in_progress → completed/canceled` (with field timestamps: en_route, arrived, started, completed)
- **Invoice:** `draft → sent → partial → paid` (or overdue/void)
- **Subscription:** `pending → active → declined/canceled`

Stripe-mirror tables (`stripe_customers`, `stripe_payment_methods`,
`stripe_terminal_locations`, `stripe_webhook_events`) keep card-on-file and
webhook idempotency data in sync with each tenant's connected account.

---

## 6. Integrations (currently attached)

| Integration | Used for |
|---|---|
| **Stripe Connect** | Per-tenant payment accounts. Invoice checkout & PaymentIntents, save-card subscriptions, **Stripe Terminal** (in-person tap-to-pay), application fees, webhooks. Each company onboards via Express or Standard. |
| **Twilio** | SMS (trial pool / dedicated / BYO number), **A2P 10DLC** brand + campaign registration & Trust Hub compliance, browser-based **voice calling**, call recording & voicemail, inbound/outbound webhooks. |
| **Resend** | Transactional + bulk email — campaign "blasts", welcome/seasonal automations, unsubscribe handling, CAN-SPAM footer. Per-tenant key or platform fallback. |
| **Anthropic Claude** | AI-assisted SMS reply drafting, with per-tenant monthly usage quotas. |
| **Meta Lead Ads** | OAuth-connect Facebook/Instagram pages; inbound webhook pipes Lead Form submissions straight into the Leads pipeline. |
| **Mapbox + Google Maps** | Interactive customer map, territory polygon drawing, door-knock canvassing pins, geocoding. |
| **Google OAuth** | Optional staff sign-in (matched to staff by email). |
| **MCP (Model Context Protocol)** | OAuth-protected `/api/mcp` server exposing CRM data to Claude/AI agents (the Settings → Connectors "Claude connector"). |

---

## 7. How it fits together (a typical flow)

1. A lead arrives — manually, via a hosted **lead form**, or from **Meta Lead Ads**.
   A **workflow** can auto-text the lead (e.g. missed-call text-back).
2. Sales sends an **estimate**; customer signs it on a public link.
3. The estimate converts to a **customer** + a scheduled **job** on the calendar,
   assigned to a tech.
4. Tech works the job (status + field timestamps update); photos/checklist captured.
5. An **invoice** is generated; customer pays via Stripe (online link, terminal, or
   saved card). Optionally a recurring **subscription** is set up and auto-billed.
6. **Payroll** computes commissions/bonuses; **reports** and the **leaderboard**
   surface performance; **activity feed** logs everything.

---

## 8. Running it locally

```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000, dev login admin/admin
npm run build        # required to pass (typecheck + Next build) before pushing
```

Dev uses a local SQLite file; prod points at Turso via `TURSO_DATABASE_URL` /
`TURSO_AUTH_TOKEN`. Integration keys (Stripe, Twilio, Resend, Anthropic, Mapbox,
Meta, Google OAuth) are supplied per-environment; see `.env.example`.
