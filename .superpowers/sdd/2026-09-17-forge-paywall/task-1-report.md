# Task 1 — Forge billing backend

Status: DONE_WITH_CONCERNS (manual recovery limitations are intentionally fail-closed; independent review requested).

## Implemented

Added isolated `forge_billing_accounts`, `forge_billing_checkout`, and `forge_billing_events` schema and additive installation from `getDb`. Exact default-off flag, shared Chicago cutoff, six integer-cent prices, employee capacities, dedicated Stripe credentials and account/mode binding. All six Prices are retrieved/validated before Checkout. No provider request occurs for disabled status or disabled purchase mutations.

Company Checkout uses a durable, unique company reservation with one fixed provider idempotency key. Concurrent attempts cannot call create twice. Unknown creation outcomes never rotate or replay a create; a known customer session is recovered by its reservation metadata. Canonically expired sessions, or completed sessions whose subscription is canonically canceled, can be retired. Checkout is the only path creating recurring purchases; success URLs have no entitlement effect.

Canonical reconciliation lists company customer subscriptions and reads the selected subscription plus paid invoices. Invoice customer/subscription/Price and mode must match; only active/past_due subscriptions with an actual future paid-through invoice period grant access. Incomplete, unpaid, paused, trialing, canceled, unknown, and expired states do not grant access. Cancel-at-period-end remains entitled through its paid period. Reconciliation claims a monotonically increasing generation before provider reads and updates with a compare-and-set. Superseded snapshots return retryable errors so a webhook is never acknowledged without its state being applied.

Signed raw-body webhooks reject Connect account/context events and mode mismatch, accept an explicit lifecycle event allowlist, resolve only known local customers, and record processed event IDs only after canonical reconciliation. Provider/database errors return 503. Existing-record reconciliation works with the rollout off.

Status, Checkout, Portal, Refresh, public rollout status, and webhook routes are in `/api/forge-billing`. Sessions determine company ownership. Purchase routes require existing `settings.view_all`, same configured site Origin, and web context; the native marker cookie and UA both deny purchase entry. Ordinary staff may view status and refresh canonical state. Portal configuration must be active and match mode, enable cancellation/payment-method updates, and disable subscription updates. Fixed configured HTTPS origin supplies all return URLs.

## Downstream interfaces

- `config.ts` and re-export from `service.ts`: `isForgeBillingEnabled(): boolean`, `billingCutoff(): string`.
- `service.ts`: `getCompanyBillingStatus(companyId:number, now?:Date): Promise<BillingStatus>`, `canManageBilling(session:SessionContext): Promise<boolean>`, `cancelCompanyBilling(companyId:number): Promise<void>`.
- `BillingStatus` exactly contains `enabled`, `allowed`, `reason` (`disabled|pre_cutoff|paid|subscription_required`), `cutoffAt`, `plan`, `interval`, `seatLimit`, `staffCount`, `paidThrough`, `subscriptionStatus`, `cancelAtPeriodEnd`.
- Additional `assertCompanyNotDeleting(db:Db, companyId:number): Promise<void>` MUST run in the staff-insertion transaction, even if rollout is off.
- `forge_billing_accounts`: primary key `company_id`; `deleting`, `seat_limit`, `plan`, `interval`, `paid_through`, `subscription_status`. Pending reservations live in `forge_billing_checkout` with `plan` and `interval`.
- HTTP GET status returns only `{enabled:false}` off; on adds `canManage` and `native` to BillingStatus. Public GET returns `{enabled:false}` or `{enabled:true,cutoffAt,trialAvailable}`. Checkout POST `{plan,interval}` and Portal POST return `{url}`. Refresh POST returns status with its additional HTTP fields.

Deletion contract: validate actor/password first; call `cancelCompanyBilling` outside any DB transaction; only proceed with irreversible deletion after success, with transaction-level revalidation. Cancellation durably sets `deleting=1`, expires open Checkout, directly reconciles/cancels completed Checkout subscriptions, and cancels all remaining subscriptions for this dedicated customer with no proration/new invoice. An unresolved provider result throws; deletion must stop. The guard stays set. No automatic unguarding: retry cleanup, or have an operator reconcile provider state and deliberately recover a canceled deletion attempt. Companies with no billing record receive a tombstone without contacting Stripe.

## Configuration (none set in production)

`FORGE_BILLING_ENABLED` must equal `true`; `FORGE_BILLING_CUTOFF_AT` defaults to `2026-09-26T05:00:00.000Z`.

Provider setup requires `FORGE_BILLING_STRIPE_SECRET_KEY`, `FORGE_BILLING_STRIPE_ACCOUNT_ID`, `FORGE_BILLING_STRIPE_MODE` (`test` or `live`), `FORGE_BILLING_WEBHOOK_SECRET`, `FORGE_BILLING_SITE_ORIGIN` (HTTPS origin without trailing slash), and `FORGE_BILLING_PORTAL_CONFIGURATION_ID`.

Prices: `FORGE_BILLING_PRICE_SOLO_MONTH`, `FORGE_BILLING_PRICE_SOLO_YEAR`, `FORGE_BILLING_PRICE_TEAM_MONTH`, `FORGE_BILLING_PRICE_TEAM_YEAR`, `FORGE_BILLING_PRICE_BUSINESS_MONTH`, `FORGE_BILLING_PRICE_BUSINESS_YEAR`.

## TDD and verification evidence

All Node commands used bundled runtime PATH `/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`, working directory `apps/web`. No `.env.local` load, remote provider request, production configuration/data change, merge, push or deploy.

RED: `node --no-warnings --experimental-strip-types --test tests/forge-billing.test.ts` initially failed with `ERR_MODULE_NOT_FOUND ... src/lib/forge-billing/service.ts`, demonstrating the missing billing implementation. After first GREEN, focused RED/GREEN cycles exposed and fixed expired-session plan selection (`Resolve the existing Checkout before choosing another plan`), deletion of completed-but-unresolved Checkout (`Missing expected rejection`), invalid dormant cutoff (`Invalid Forge billing cutoff`), and stale reconciliation acknowledgment (`Missing expected rejection`).

Final focused GREEN: same command, **20 tests, 20 pass, 0 fail**. Tests use real SQLite databases and production modules, replacing only Stripe/session boundary imports. Coverage includes concurrency, lost create responses, unknown outcomes after arbitrarily long delays, provider configuration/ownership, canonical invoice entitlement, invalid states, tenant isolation, admin/custom permissions, native/origin restrictions, signatures/Connect/mode, duplicates, unknown customers, cancellation and deletion guards, stale snapshot rejection, and real `getDb` installation on existing v24 databases. The v24 upgrade test first failed with `no such table: forge_billing_accounts`; the additive installer now runs on the schema fast path as well as full initialization, avoiding legacy data migration replay.

Full suite run once: `TURSO_DATABASE_URL=file:/private/tmp/forge-billing-never-default.db TURSO_AUTH_TOKEN=local-test FORGE_BILLING_ENABLED=false node --no-warnings --experimental-strip-types --test tests/*.test.ts`: **348 tests, 348 pass, 0 fail**. Full-suite run preceded the final self-review CAS-retry and v24 schema-fast-path adjustments; the complete focused billing suite and TypeScript were rerun after those adjustments.

`npx tsc --noEmit --incremental false`: exit 0, no output. This checks the installed Stripe v22 SDK types, including invoice pricing/parent structures and `accounts.retrieve(null)` for the key's own platform account. `/usr/bin/git diff --check`: exit 0, no output.

After the schema-fast-path adjustment: `node --no-warnings --experimental-strip-types --test tests/terminal-schema.test.ts tests/schema-v16-upgrade.test.ts`: **3 tests, 3 pass, 0 fail**, preserving prior schema migration behavior.

## Self-review and concerns

Self-review corrected platform account verification to retrieve the key's own account (not an accessible connected account), protected completed Checkout deletion against unknown subscription creation, and made superseded state snapshots retry rather than acknowledging an unapplied webhook. No unresolved known test failures.

Intentional availability tradeoff: if customer creation succeeds at Stripe but its response is lost, the account remains reserved with no local customer ID. This requires manual support reconciliation of the recorded customer key/company metadata; no automatic customer search or unsafe replay is provided. Likewise, an unknown Checkout session that never becomes visible stays blocked until operator reconciliation. Never delete these reservations to unblock billing without canonical provider investigation.

Operator-edited subscriptions/Price IDs, multiple simultaneous subscriptions, or unexpectedly paginated invoice line items fail closed for support rather than guessing entitlement. Portal configuration is checked before issuing each portal session; production configuration must continue to prevent plan changes. Real Stripe test-mode end-to-end confirmation, final App Store/native behavior, production build, activation checklist and customer notices remain controller/activation work, not evidence claimed here.

Owned changes: `apps/web/src/lib/forge-billing/{config,catalog,schema,provider,reconcile,service,http,webhook}.ts`; six `apps/web/src/app/api/forge-billing/*/route.ts`; additive `apps/web/src/lib/db.ts` import/install; `apps/web/tests/forge-billing.test.ts`; `apps/web/tests/helpers/forge-billing-harness.mjs`; this report.
