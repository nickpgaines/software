# Forge Company Paywall Implementation Plan

> Historical completed plan. Its shared-cutoff policy and `cutoffAt`/`pre_cutoff`
> interfaces were superseded by the user-approved September 21 amendment in
> the linked design and `docs/forge-billing-release.md`: frozen company signup
> plus 14 days, `trialEndsAt`/`trial`, and no automatic activation.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement dormant company subscription billing and paywall with a shared provisional cutoff.

**Architecture:** A separate platform-billing service owns provider state and company entitlement. Edge middleware delegates enabled-only access checks to a Node route; billing/recovery remain outside the lock. Shared server state drives the browser billing screen, while native sees status only.

**Tech Stack:** Next.js 14, React 18, TypeScript, existing libSQL Db abstraction, Stripe SDK 22, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-17-forge-paywall-design.md`

## Global Constraints

- `FORGE_BILLING_ENABLED` defaults off; only exact `true` enables customer-visible billing and enforcement.
- Proposed shared cutoff: September 26, 2026 at 00:00 America/Chicago (`2026-09-26T05:00:00.000Z`), configurable via `FORGE_BILLING_CUTOFF_AT`.
- Do not merge, deploy, enable a flag, provision live Stripe objects, send notices, charge accounts, or change production data as part of this implementation.
- One subscription per company. Solo $79/month or $790/year (1 employee), Team $149/month or $1,490/year (8), Business $229/month or $2,290/year (30).
- No new owner role; `settings.view_all` manages billing. No native purchase CTA. No schema rebuild/drop or auth signing changes.
- Separate dedicated Forge billing Stripe keys/tables; no fallback to Connect credentials. Preserve existing financial recovery and public service agreements.

### Task 1: Company billing service, provider lifecycle and APIs

**Files:** Create `apps/web/src/lib/forge-billing/{config,catalog,schema,service,http}.ts`, `apps/web/src/app/api/forge-billing/{status,checkout,portal,refresh,webhook,public}/route.ts`, `apps/web/tests/forge-billing.test.ts`, `apps/web/tests/helpers/forge-billing-harness.mjs`. Modify `apps/web/src/lib/db.ts` only for additive schema installation. File splits within this directory are allowed to keep provider/state responsibilities small.

**Interfaces:** Expose `isForgeBillingEnabled(): boolean`, `billingCutoff(): string`, `getCompanyBillingStatus(companyId:number, now?:Date): Promise<BillingStatus>`, `canManageBilling(session:SessionContext): Promise<boolean>`, and `cancelCompanyBilling(companyId:number): Promise<void>`. `BillingStatus` has `enabled:boolean`, `allowed:boolean`, `reason:'disabled'|'pre_cutoff'|'paid'|'subscription_required'`, `cutoffAt:string`, `plan:'solo'|'team'|'business'|null`, `interval:'month'|'year'|null`, `seatLimit:number|null`, `staffCount:number`, `paidThrough:string|null`, `subscriptionStatus:string|null`, `cancelAtPeriodEnd:boolean`. Status GET adds `canManage:boolean` and `native:boolean`. Off returns only `{enabled:false}` from HTTP (service can provide full type without querying provider). Public GET returns `{enabled:false}` off, or `{enabled:true,cutoffAt,trialAvailable:boolean}` on. Checkout POST `{plan,interval}` returns `{url}`; Portal POST returns `{url}`; Refresh POST reconciles canonical state then returns status. Requests tenant-bound and same-origin; native mutation denied. Dedicated signed webhook doesn't require user session.

- [x] Write failing real-SQLite tests for cutoff, dormant behavior, provider lifecycle, authentication, tenant ownership, idempotency and races. Example behavior:
  ```ts
  process.env.FORGE_BILLING_ENABLED = 'false';
  assert.equal((await getCompanyBillingStatus(2, new Date('2026-10-01'))).allowed, true);
  process.env.FORGE_BILLING_ENABLED = 'true';
  assert.equal((await getCompanyBillingStatus(2, new Date('2026-09-26T05:00:00Z'))).allowed, false);
  ```
- [x] Run `node --no-warnings --experimental-strip-types --test tests/forge-billing.test.ts` using bundled Node; record missing-behavior RED.
- [x] Implement schema/config/catalog and service. Use exact flag comparison, integer cents `{solo:{month:7900,year:79000},team:{month:14900,year:149000},business:{month:22900,year:229000}}`, validate configured provider Prices. Dedicated secret key. Durable per-company Checkout reservation with fixed provider idempotency, known-customer binding and reconciliation before retry. Unknown provider outcome cannot rotate keys. No activation from browser success URL. Do not create paid recurring subscriptions before explicit checkout.
- [x] Implement routes and canonical webhook sync, with SDK types checked locally. Use explicit platform-only events, verified provider mode, known local customer, paid-through entitlement, stale-update prevention. Status/refresh allow recovery; off mutations fail without provider calls; existing webhook/cancellation cleanup works off.
- [x] Cover full task spec in tests; run focused tests then full suite once, commit only owned files, self-review, write report with RED/GREEN evidence and exact downstream interfaces.

### Task 2: Authoritative paywall enforcement, escape routes and lifecycle cleanup

**Files:** Create `apps/web/src/lib/forge-billing/access.ts`, `apps/web/src/app/api/forge-billing/{access,export}/route.ts`, `apps/web/tests/forge-billing-access.test.ts`. Modify `apps/web/src/middleware.ts`, bearer widget/MCP entrypoints, staff creation entrypoint, and company account-deletion workflow. No UI changes in this task.

**Interfaces:** Consume Task 1 service/config/status and cancelCompanyBilling. Produce authenticated uncached access endpoint `{allowed:boolean,reason:string}`. Standalone page destination `/billing`, native equivalent same destination with conservative status UI. Export GET returns downloadable company business records without secrets, limited to `settings.view_all`.

- [x] Write failing tests using real middleware/route functions with HTTP/provider boundaries doubled: off never checks DB/provider nor redirects; enabled unpaid blocks page/API; safe routes still work; forged headers cannot bypass; stale cookie/tenant data cannot authorize access. Example:
  ```ts
  assert.equal((await middleware(unpaidRequest('/api/jobs'))).status, 402);
  assert.equal((await middleware(unpaidRequest('/dashboard'))).headers.get('location'), 'https://www.forgecrm.app/billing');
  ```
- [x] Record RED focused command before implementation.
- [x] Add enabled-only middleware delegation after normal authentication/CSRF handling. Preserve public financial callbacks and API exclusions. Explicit exact/prefix-with-boundary safe routes: billing APIs/page, me/profile essentials, logout/auth/deletion, support, export, existing Terminal reconciliation/list/cancel and already-created charge confirmation. Never exempt new payment/Terminal creation or arbitrary client headers. Access endpoint internally skips enforcement but still authenticates directly. Provider webhook/public billing config matcher exclusions must be exact/boundary-safe.
- [x] Add bearer entitlement checks to widget summary and MCP execution, preserving revocation. Add transaction-safe subscribed seat check to all staff creation paths, no data deletion for over-cap companies. Integrate company deletion cancellation before irreversible local deletion; provider failure retains account and returns retryable failure.
- [x] Audit alternate routes and existing background work. Document existing merchant service billing/public links preserved, and identify provider-cost automation decisions for activation checklist; no silent cancellation of homeowner service agreements. Export explicitly allowlisted business columns, never `SELECT *` on credentials/customer token tables.
- [x] Run focused access/lifecycle regression tests and full suite; commit owned files, report concrete coverage and any remaining activation gates.

### Task 3: Dormant web billing and conservative native status UI

**Files:** Create `apps/web/src/app/billing/page.tsx`, `apps/web/src/components/billing/ForgeBilling.tsx`, `apps/web/tests/forge-billing-ui.test.ts`, `docs/forge-billing-release.md`. Modify BillingPanel in SettingsTabs and marketing/signup copy only as needed behind the enabled check.

**Interfaces:** Consume Task 1 status/checkout/portal/refresh/public APIs; Task 2 export and account deletion safe paths. Off status keeps Settings placeholder; direct `/billing` routes back to normal app with no paywall flash. Native status uses existing native detection plus server native verdict and exposes no price/checkout/portal link.

- [x] Read DESIGN_SYSTEM.md fully, use existing UI primitives. Write failing UI behavior tests for hidden/off, web billing admin, ordinary employee, native, load failure, stale session and retry. Example:
  ```ts
  assert.equal(renderedText({enabled:false}).includes('Subscribe'), false);
  assert.equal(renderedText({enabled:true,native:true}).includes('$79'), false);
  ```
- [x] Run focused tests to record RED; implement exact monthly/annual pricing and seat labels, explicit interval selection, disabled incompatible plan, pending controls, typed errors, no optimistic unlock after redirect, refresh status action. Provide existing subscriber portal management; no second subscription CTA for existing nonterminal provider subscription.
- [x] Preserve logout/support/account deletion (complete existing deletion UI, not merely a link to blocked Settings), and authorized export on locked screen. Don't initialize ordinary CRM providers under `/billing`. Existing settings/nav behavior remains visually identical when disabled.
- [x] Only when enabled, align website/signup trial copy with shared cutoff. Off preserves existing copy. Never change public production configuration or call Stripe during UI tests.
- [x] Run focused UI tests and full suite, TypeScript and isolated local production build. Document required env names with sensitivity, dedicated Stripe test setup and webhook/portal configuration, nonautomatic activation, owner checklist, limitations. Commit, self-review, report verification.

## Final verification

- [x] Independent per-task reviews and final whole-branch review; fix blocking findings with covering regression tests.
- [x] Full suite, `npx tsc --noEmit`, isolated-file SQLite `npm run build` with placeholder Stripe key; no live DB/provider usage.
- [x] Feature branch only; report dormant implementation and any activation blockers. No merge/deployment without a new explicit instruction.
