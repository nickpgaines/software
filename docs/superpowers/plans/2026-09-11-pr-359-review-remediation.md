# PR 359 Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every load-bearing review finding on PR #359 and leave the existing PR branch verified and ready for a final human merge decision.

**Architecture:** Keep Twilio transport normalization and registration policy at the server boundary, serialize the state machine with a short database lease, gate automated SMS on existing estimate consent, and make widget cache mutations credential-conditional. Reuse current permission, token, metric, and test infrastructure instead of introducing new services.

**Tech Stack:** Next.js 14 route handlers, TypeScript, libSQL/SQLite, Node test runner, Twilio REST APIs, Swift 5, XCTest, WidgetKit, Security framework.

**Spec:** `docs/superpowers/specs/2026-09-11-pr-359-review-remediation.md`

## Global Constraints

- Preserve all unrelated tracked and untracked user files.
- Use test-driven development: add a failing regression first, observe the failure, implement the minimum fix, and rerun the focused suite.
- Do not add a live Twilio dependency to tests; use exact response fixtures and injected transports.
- Do not merge. Updating the feature branch/PR happens only after the final verification gate.
- Apple Pay and broad Stripe payment architecture are out of scope.

---

### Task 1: Twilio Registration Contract, Authorization, and Submission Policy

**Files:**
- Modify: `apps/web/src/lib/twilio-trust-hub.ts`
- Modify: `apps/web/src/lib/sms-registration.ts`
- Modify: `apps/web/src/lib/sms-registration-input.ts`
- Modify: `apps/web/src/app/api/sms/registration/route.ts`
- Modify: `apps/web/src/components/SettingsTabs.tsx`
- Create: `apps/web/src/lib/sms-registration-access.ts`
- Create: `apps/web/src/lib/public-website.ts`
- Test: `apps/web/tests/sms-registration.test.ts`
- Create: `apps/web/tests/sms-registration-route.test.ts`
- Create: `apps/web/tests/public-website.test.ts`

**Interfaces:**
- Consumes: `getSessionContext()`, `loadWidgetPermissions(db, principal)`, and existing Twilio transport injection in `sms-registration.ts`.
- Produces: `requireSmsRegistrationAccess(): Promise<{ companyId: number; staffId: number | null }>`; `verifyPublicWebsite(url: URL, dependencies?): Promise<string | null>`; normalized brand `status` and campaign `campaign_status` handling used by Task 2.

- [ ] **Step 1: Add failing contract and policy tests**

Add tests using exact fixtures such as `{ status: "APPROVED" }` and `{ campaign_status: "VERIFIED" }`. Assert literal `true` is required for all three attestations, unsupported entities fail, an approved registration rejects mutation, unauthorized staff get 403, every accepted POST replaces `submitted_at`, failed brand/campaign states return support guidance instead of recreating or relabeling the existing SID, and private/unreachable/redirecting website cases are bounded and SSRF-safe.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='registration|website'`

Expected: at least one new assertion fails against the existing lowercase status mapping, truthiness checks, missing permission gate, or missing website verifier.

- [ ] **Step 3: Normalize Twilio contracts and tighten validation**

Normalize provider statuses once with `status.trim().toUpperCase().replaceAll("-", "_")`; treat `PENDING`, `PENDING_REVIEW`, `IN_REVIEW`, and `IN_PROGRESS` as pending; `TWILIO_APPROVED`, `APPROVED`, `COMPLIANT`, and `VERIFIED` as approved; and `TWILIO_REJECTED`, `REJECTED`, `FAILED`, and `NONCOMPLIANT` as failed. Model campaign responses as `campaign_status` and pass that value to the predicates.

Change attestation guards to exact comparisons:

```ts
if (body.confirmed_authorized !== true) return "You must confirm you're authorized to register this business.";
if (body.confirmed_aup_tcpa !== true) return "You must confirm agreement with the SMS AUP and TCPA.";
if (body.confirmed_consent !== true) return "You must confirm recipients have provided consent.";
```

Limit entity choices to `LLC`, `Corporation`, `Partnership`, and `Sole Proprietorship` in both validator and UI. Store booleans with `body.confirmed_* === true ? 1 : 0`.

- [ ] **Step 4: Add route authorization and immutable approved state**

Implement `requireSmsRegistrationAccess` from `getSessionContext`, `getDb`, and `loadWidgetPermissions`; platform admins pass, tenant staff require `settings.view_all`, and failures return typed 401/403 responses without exposing another tenant. Use it in GET and POST before reading or advancing. Reject POST with 409 when state is `paid_approved`; make the approved form read-only in `SettingsTabs.tsx`.

- [ ] **Step 5: Add SSRF-safe website reachability validation**

Implement an injected resolver/fetcher helper which permits only HTTPS, rejects credentials, IP-literal hosts, localhost and reserved names, rejects every resolved private/link-local/loopback/multicast/reserved IPv4 or IPv6 address, follows at most three redirects while repeating validation, uses a five-second abort timeout, and accepts only 200-399. Validate before writing registration data. Do not compare page text to the legal name; Twilio remains authoritative for that review.

- [ ] **Step 6: Make retry and timestamp behavior honest**

Set `submitted_at = datetime('now')` on every accepted update. Permit explicit fresh-resource retry only for Customer Profile and Trust Product failures. For Brand or Campaign rejection, preserve the failed SID/state and return stage-specific guidance to contact support/correct the provider record rather than changing it back to pending. Update the settings copy and actions accordingly.

- [ ] **Step 7: Run focused and full web tests**

Run: `cd apps/web && npm test -- --test-name-pattern='registration|website'`

Run: `cd apps/web && npm test`

Expected: all tests pass.

- [ ] **Step 8: Commit**

Commit message: `fix: harden sms registration submission`

---

### Task 2: Company-Scoped Registration Advancement Lease

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Create: `apps/web/src/lib/sms-registration-lease.ts`
- Modify: `apps/web/src/lib/sms-registration.ts`
- Test: `apps/web/tests/sms-registration.test.ts`
- Create: `apps/web/tests/sms-registration-lease.test.ts`

**Interfaces:**
- Consumes: normalized registration state machine from Task 1.
- Produces: `withSmsRegistrationLease<T>(db: Db, companyId: number, work: () => Promise<T>): Promise<{ acquired: boolean; value?: T }>` wrapping one full advancement attempt.

- [ ] **Step 1: Add failing lease tests**

Assert two concurrent calls for one company execute `work` once, different companies may advance independently, release permits a later attempt, and a lease older than five minutes can be reclaimed. Add an advancement regression whose delayed Twilio create fixture proves concurrent callers create one resource.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='lease|concurrent'`

Expected: duplicate work/resource creation occurs before the lease exists.

- [ ] **Step 3: Add schema and atomic lease acquisition**

Create `sms_registration_leases(company_id INTEGER PRIMARY KEY, lease_token TEXT NOT NULL, expires_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))` in the normal idempotent database initialization. Acquire with a transaction that deletes only expired rows, inserts a cryptographically random token, and treats the unique-key conflict as `acquired: false`. Release with `DELETE ... WHERE company_id = ? AND lease_token = ?` in `finally` so one worker cannot release another worker's reclaimed lease.

- [ ] **Step 4: Wrap the complete state-machine attempt**

Move the existing recursion/loop behind one acquired lease. Callers that do not acquire return the current persisted state without invoking Twilio. Do not acquire separately per recursive state transition.

- [ ] **Step 5: Run focused and full web tests**

Run: `cd apps/web && npm test -- --test-name-pattern='registration|lease|concurrent'`

Run: `cd apps/web && npm test`

Expected: all tests pass and concurrent same-company creation count is one.

- [ ] **Step 6: Commit**

Commit message: `fix: serialize sms registration advancement`

---

### Task 3: Transactional Consent Gate for Lifecycle SMS

**Files:**
- Modify: `apps/web/src/lib/job-lifecycle-dispatch.ts`
- Test: `apps/web/tests/job-lifecycle-dispatch.test.ts`

**Interfaces:**
- Consumes: existing `estimates.sms_transactional_consent`, lifecycle claim/outcome ledger, and `job.customerId`/`companyId`.
- Produces: consent predicate embedded in `dispatchJobLifecycleNotification`; no interface changes for route callers.

- [ ] **Step 1: Add failing consent tests**

For every lifecycle step, assert a customer with no consented estimate produces no call to `send`, returns `null`, and records `outcome = 'skipped'` with a consent-specific diagnostic. Assert an estimate for another company/customer does not count. Assert at least one same-company, same-customer estimate with `sms_transactional_consent = 1` permits the existing send path.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='lifecycle.*consent|consent.*lifecycle'`

Expected: the existing dispatcher calls `send` without affirmative consent.

- [ ] **Step 3: Gate before message construction and sending**

After the lifecycle ledger claim, query:

```sql
SELECT 1
  FROM estimates
 WHERE company_id = ?
   AND customer_id = ?
   AND sms_transactional_consent = 1
 LIMIT 1
```

When absent, record a skipped outcome with `message_id = NULL` and error text `Transactional SMS consent has not been recorded for this customer.`; then return `null`. Preserve opt-out enforcement in the downstream SMS sender.

- [ ] **Step 4: Run focused and full web tests**

Run: `cd apps/web && npm test -- --test-name-pattern='job lifecycle'`

Run: `cd apps/web && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

Commit message: `fix: require consent for lifecycle texts`

---

### Task 4: Credential-Conditional iOS Widget Cache and Keychain Safety

**Files:**
- Modify: `apps/mobile/ios/App/App/ForgeWidgetStore.swift`
- Modify: `apps/mobile/ios/App/ForgeWidgets/WidgetAPIClient.swift`
- Modify: `apps/mobile/ios/App/App/ForgeWidgetPlugin.swift`
- Test: `apps/mobile/ios/App/ForgeWidgetTests/ForgeWidgetStoreTests.swift`
- Test: `apps/mobile/ios/App/ForgeWidgetTests/WidgetProviderTests.swift`

**Interfaces:**
- Consumes: existing `ForgeWidgetCredential`, snapshot schema, and plugin API.
- Produces: `saveSnapshot(_:ifCredentialMatches:) -> Bool`, `clearCredentialAndCache(ifCredentialMatches:) -> Bool`, and fallback behavior that reloads cache after verifying the active credential.

- [ ] **Step 1: Add failing race and Keychain tests**

Add deferred transport tests for: account B replacing account A before A returns 500/offline/malformed/mismatched data; stale A 401/403 after B is active; and A 200 racing a credential swap between validation and persistence. Expected result never returns A's cache, never clears B, and never saves A over B. Add a Security-store seam test that verifies both insert and update request `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

- [ ] **Step 2: Run widget tests and observe failure**

Run the `ForgeWidgetTests` scheme with the existing simulator destination used by the repository.

Expected: stale fallback or unauthorized-response assertions fail before conditional store operations exist.

- [ ] **Step 3: Make store mutations conditional and synchronized**

Protect compound credential/cache operations with one process-wide `NSLock` (or equivalent shared lock) and implement:

```swift
@discardableResult
func saveSnapshot(_ snapshot: ForgeWidgetSnapshot, ifCredentialMatches expected: ForgeWidgetCredential) throws -> Bool

@discardableResult
func clearCredentialAndCache(ifCredentialMatches expected: ForgeWidgetCredential) throws -> Bool
```

Both compare and mutate while holding the same lock. Avoid nested public calls that reacquire a non-recursive lock by using private unlocked helpers.

- [ ] **Step 4: Reload fallback against the active credential**

Remove the pre-request cached capture. On every non-success path, reload credential and cache at response time; return cached data only when the current credential equals the request credential. For 401/403, conditionally clear only the request credential; if a newer credential is active, return reconnect without clearing or exposing the old snapshot. Apply identical conditional operations in `ForgeWidgetPlugin.refreshSnapshot`.

- [ ] **Step 5: Migrate Keychain accessibility**

Use `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` on insertion and include the same attribute in `SecItemUpdate`, so writing an existing key migrates it away from synchronizable/restorable device transfer behavior.

- [ ] **Step 6: Run iOS tests and builds**

Run the `ForgeWidgetTests` scheme, then the existing simulator app build and signed Release build commands documented/used by this branch.

Expected: all widget tests and both builds pass.

- [ ] **Step 7: Commit**

Commit message: `fix: isolate widget data by credential`

---

### Task 5: Durable Logout Revocation and ARR Parity

**Files:**
- Modify: `apps/web/src/app/api/logout/route.ts`
- Modify: `apps/web/src/lib/widget-auth.ts`
- Modify: `apps/web/src/lib/native-widget.ts`
- Modify: `apps/web/src/lib/widget-metrics.ts`
- Test: `apps/web/tests/widget-auth.test.ts`
- Test: `apps/web/tests/native-widget.test.ts`
- Test: `apps/web/tests/widget-metrics.test.ts`
- Create: `apps/web/tests/logout-route.test.ts`

**Interfaces:**
- Consumes: authenticated `SessionContext`, widget token storage, and `calculateCurrentMrrCents` defaults used by the subscriptions report.
- Produces: `revokeWidgetTokensForStaff(db, companyId, staffId): Promise<number>` and widget ARR matching the report defaults.

- [ ] **Step 1: Add failing logout and ARR tests**

Assert logout revokes all non-revoked widget tokens for the current staff member and tenant before expiring the cookie; platform-admin/no-staff logout remains successful; another staff member's tokens remain valid; and a database failure returns 500 without clearing the cookie. Assert widget ARR includes tax and a paid cancellation inside the prior-month window, excludes older cancellations, and equals the report's default MRR times twelve.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='logout|ARR|cancellation'`

Expected: server logout leaves widget tokens active and widget ARR omits recent paid cancellations.

- [ ] **Step 3: Revoke server tokens before cookie deletion**

Add a tenant-scoped update helper that sets `revoked_at = datetime('now')` for all active tokens matching company and staff. In POST, resolve the session, revoke first when `staffId` exists, and only then return the cookie-clearing response. Keep the native plugin clear/revoke calls as best effort; the authenticated server logout is the durable authority.

- [ ] **Step 4: Align widget ARR with report defaults**

Select active and canceled subscription rows for the tenant, then call:

```ts
calculateCurrentMrrCents(rows, {
  includeTax: true,
  includeRecentCanceled: true,
  now,
}) * 12
```

Do not fork the report formula.

- [ ] **Step 5: Run focused and full verification**

Run: `cd apps/web && npm test`

Run: `cd apps/web && npm run build`

Run the iOS widget test scheme, simulator app build, and signed Release build.

Expected: all web tests, production web build, iOS tests, and iOS builds pass.

- [ ] **Step 6: Commit**

Commit message: `fix: revoke widget sessions on logout`

---

### Task 6: Durable Job Payment Idempotency

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Create: `apps/web/src/lib/payment-idempotency.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/payments/route.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/payments/stripe-intent/route.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/payments/stripe-confirm/route.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/payments/charge-saved-card/route.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/payments/terminal-intent/route.ts`
- Modify: `apps/web/src/components/jobs/RecordPaymentModal.tsx`
- Create: `apps/web/tests/payment-idempotency.test.ts`
- Test: `apps/web/tests/payment-job-completion.test.ts`

**Interfaces:**
- Consumes: existing payment schema, Stripe connected-account calls, payment completion helper, and receipt delivery.
- Produces: `requireIdempotencyKey(req: Request): string`; `paymentRequestFingerprint(input): string`; `insertPaymentIdempotently(tx, input): Promise<{ payment: Payment; created: boolean }>`; response fields `idempotent_replay`, `lifecycle_notification`, and `warning` consumed by Task 8.

- [ ] **Step 1: Add failing replay and concurrency tests**

Assert missing/invalid `Idempotency-Key` returns 400; matching manual replay returns the original payment with 200 and does not repeat receipt/completion side effects; the same key with changed amount/tip/method/notes/receipt options returns 409; simultaneous same-key inserts create one row; Stripe confirm for one PaymentIntent creates one row; an existing intent on a different job is rejected; and saved-card/intent/terminal calls pass a deterministic Stripe idempotency key.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='payment.*idempoten|idempoten.*payment'`

Expected: repeated manual and concurrent Stripe paths create duplicate effects or accept a missing key.

- [ ] **Step 3: Add backward-compatible idempotency schema**

Add nullable `payments.idempotency_key` and `payments.request_fingerprint`, plus a partial unique index on `(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. Do not add a uniqueness constraint directly to historical `stripe_payment_intent_id` before production duplicate auditing.

- [ ] **Step 4: Implement shared insert and conflict semantics**

Normalize caller keys to printable 8-200 character values. Hash a stable JSON representation of job, amount, tip, method, notes, and receipt choices with SHA-256. Insert with a namespaced key (`manual:`, `saved-card:`, or `stripe-confirm:`) using conflict-do-nothing, then reload by tenant/key. Return the existing payment only when fingerprints match; otherwise throw a typed conflict mapped to 409.

- [ ] **Step 5: Make provider and browser retries idempotent**

Pass deterministic Stripe keys such as `forge:${companyId}:${jobId}:saved:${key}` in connected-account request options. Generate one `crypto.randomUUID()` per intentional modal payment attempt, preserve it across retries and the intent/confirm sequence, and rotate it after success or material input changes. Do not resend receipts or enqueue completion for `created: false`.

- [ ] **Step 6: Run focused and full web tests**

Run: `cd apps/web && npm test -- --test-name-pattern='payment|Stripe'`

Run: `cd apps/web && npm test`

Expected: all tests pass.

- [ ] **Step 7: Commit**

Commit message: `fix: make job payments idempotent`

---

### Task 7: Crash-Recoverable Lifecycle Outbox and Tenant Time Zone

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Create: `apps/web/src/lib/time-zone.ts`
- Create: `apps/web/src/lib/job-lifecycle-outbox.ts`
- Modify: `apps/web/src/lib/job-lifecycle-dispatch.ts`
- Modify: `apps/web/src/lib/job-status-transitions.ts`
- Modify: `apps/web/src/lib/payment-job-completion.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/status/route.ts`
- Modify: `apps/web/src/app/api/settings/company/route.ts`
- Modify: `apps/web/src/components/SettingsTabs.tsx`
- Create: `apps/web/src/app/api/cron/job-lifecycle-notifications/route.ts`
- Modify: `apps/web/vercel.json`
- Test: `apps/web/tests/job-lifecycle-dispatch.test.ts`
- Test: `apps/web/tests/payment-job-completion.test.ts`
- Create: `apps/web/tests/job-lifecycle-outbox.test.ts`
- Create: `apps/web/tests/time-zone.test.ts`

**Interfaces:**
- Consumes: Task 3 consent rule, Task 6 idempotent payment transaction, existing customization/message builders, `CRON_SECRET` route pattern, and `sendAndLogCompanySms`.
- Produces: `prepareJobLifecycleNotification`, `enqueueJobLifecycleNotification`, `deliverJobLifecycleNotification`, and `runPendingJobLifecycleNotifications`; durable notification summaries consumed by Tasks 6 and 8.

- [ ] **Step 1: Add failing atomicity, draining, and timezone tests**

Assert transition/payment commit leaves a pending notification even when immediate delivery never runs; concurrent immediate/cron drainers invoke `send` once; failed provider submissions become `failed`; `sending` older than ten minutes becomes `unknown` and is not auto-retried; synthetic payment steps are skipped while completion is pending; cron authentication is enforced; Chicago and New York tenants render distinct correct times; invalid IANA zones return 400; and a legacy company retains Eastern time.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='outbox|lifecycle|time zone'`

Expected: lifecycle claim is post-commit, no pending drain exists, or Fly/Vercel UTC is rendered through the hard-coded zone.

- [ ] **Step 3: Extend the lifecycle ledger**

Add nullable `customer_id` and `body`, `attempt_count INTEGER NOT NULL DEFAULT 0`, `locked_at`, `last_attempt_at`, `retry_requested_at`, and `retry_requested_by`, plus an `(outcome, created_at)` index. Supported outcomes are `pending`, `sending`, `sent`, `skipped`, `failed`, and `unknown`. Migrate legacy `claimed` to `unknown` so ambiguous provider calls are never replayed automatically.

- [ ] **Step 4: Prepare then enqueue atomically**

Prepare customization, company/timezone, consent, and message before mutating the job. In one transaction, conditionally update lifecycle timestamps and insert pending/skipped/failed rows; payment transactions insert the payment, synthetic skipped steps, and completion outbox row together. Commit before immediate delivery.

- [ ] **Step 5: Claim and deliver at most once automatically**

Claim with a conditional `pending -> sending` update and increment `attempt_count`. Set `sent` or `failed` after `sendAndLogCompanySms`. Mark `sending` rows older than ten minutes `unknown`; never auto-retry `unknown`. The cron route authenticates with the established `CRON_SECRET` contract, drains pending rows every five minutes, and returns counts.

- [ ] **Step 6: Add tenant timezone configuration**

Add `company.time_zone TEXT NOT NULL DEFAULT 'America/New_York'`. Validate with `Intl.DateTimeFormat(undefined, { timeZone: value })` plus exact non-empty input. Expose the value through company settings and use it in lifecycle message construction.

- [ ] **Step 7: Run focused and full web tests**

Run: `cd apps/web && npm test -- --test-name-pattern='outbox|lifecycle|payment|time zone'`

Run: `cd apps/web && npm test`

Expected: all tests pass.

- [ ] **Step 8: Commit**

Commit message: `fix: make lifecycle texts recoverable`

---

### Task 8: Operator-Visible Lifecycle Delivery and Controlled Retry

**Files:**
- Create: `apps/web/src/app/api/jobs/[id]/lifecycle-notifications/route.ts`
- Create: `apps/web/src/app/api/jobs/[id]/lifecycle-notifications/[notificationId]/retry/route.ts`
- Create: `apps/web/src/components/jobs/LifecycleNotificationPanel.tsx`
- Modify: `apps/web/src/components/JobDetailClient.tsx`
- Modify: `apps/web/src/components/jobs/RecordPaymentModal.tsx`
- Modify: `apps/web/src/lib/job-lifecycle-notifications.ts`
- Test: `apps/web/tests/job-lifecycle-outbox.test.ts`
- Create: `apps/web/tests/job-lifecycle-routes.test.ts`

**Interfaces:**
- Consumes: Task 7 outbox records/delivery APIs and Task 6 payment response summary.
- Produces: tenant-scoped notification GET and retry POST APIs plus job-page status/retry UI.

- [ ] **Step 1: Add failing authorization, retry, and UI contract tests**

Assert GET is scoped by both tenant and job; failed retry transitions to pending and attempts delivery; unknown retry requires `{ "confirm_unknown": true }`; sent/sending/pending/skipped cannot be retried; retry audit fields capture staff/time; another tenant cannot inspect or retry; payment success with delivery failure includes a warning; and job UI renders pending/failed/unknown labels plus the correct retry/confirmation actions.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cd apps/web && npm test -- --test-name-pattern='lifecycle.*route|notification.*retry|payment.*warning'`

Expected: no notification read/retry API or operator UI exists.

- [ ] **Step 3: Add tenant-scoped APIs and controlled retry**

GET returns id, step, outcome, attempt count, message ID, error, and timestamps. Retry permits `failed -> pending`; permits `unknown -> pending` only with explicit confirmation; rejects every other state with 409; and records `retry_requested_at`/`retry_requested_by` before immediate delivery.

- [ ] **Step 4: Surface state and warnings in the job UI**

Show non-sent lifecycle records in a compact panel. Failed rows offer `Retry text`; unknown rows present a duplicate-risk confirmation before retry; pending/sending are informational. After a successful payment, close the modal as today and surface the API `warning` without treating the valid payment as failed.

- [ ] **Step 5: Run full verification**

Run: `cd apps/web && npm test`

Run: `cd apps/web && npm run build`

Expected: all tests and the production build pass.

- [ ] **Step 6: Commit**

Commit message: `feat: surface lifecycle text delivery`
