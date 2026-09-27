# Tap to Pay Outcomes and Declined Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve missed outcomes for the initiating staff member and share verified declined-transaction documents without native push.

**Architecture:** Store immutable provider observations separately from mutable attempt status and per-staff acknowledgment. Derive unresolved attention from original attempts; extend existing recovery UI without changing canonical payment recording. Generate private declined documents from a specific verified failed Charge.

**Tech Stack:** TypeScript/Next.js, SQLite/libSQL, Stripe, React, existing Capacitor bridge and native activity sheet.

**Spec:** `docs/superpowers/specs/2026-09-26-tap-to-pay-outcomes-design.md` and shared `2026-09-26-tap-to-pay-review-gaps-design.md`.

## Global Constraints

- No APNs, native push permission prompts, push credentials, new push provider, automatic operational email, or SMS notifications.
- No production enablement, deployment, live transactions, Apple terms acceptance, account unlinking, Apple submission, or customer announcement delivery in this work. Payment/auth merges require separate approval.
- Stripe/server-confirmed payment facts remain authoritative. Transport failures and timeouts are not declines.
- No production backfill or new historical alerts. Legacy unowned attempts remain recoverable.
- Never release an unresolved reservation through acknowledgment, receipt viewing, or UI dismissal.
- Preserve Release test isolation and current design-system primitives. Apple acceptance of reopen-only notices remains unconfirmed.

## Review Focus

1. Legacy/concurrent startup must not break login or guess initiators (Task 1).
2. Two declines then success on one intent must remain three distinct facts (Task 2).
3. Delayed old acknowledgment must not hide a newer result (Task 3).
4. Rollout withdrawal must not suppress recovery or expose another staff member's notices (Task 3).
5. A failed share/lookup must never imply receipt delivery or permission to charge again (Task 4).

## Execution conventions

Web commands run from `apps/web`, Node 24. Use real disposable SQLite via `tests/helpers/terminal-harness.mjs` and `payment-harness.mjs`; extend fake Stripe with account-scoped Charges and event identities, not mocked business logic. Use `/usr/bin/git`, exact changed paths only.

### Task 1: Additive ownership and observation storage

**Files:** Modify `apps/web/src/lib/terminal-schema.ts`, `terminal-attempts.ts`; create `apps/web/src/lib/terminal-outcomes.ts`; tests modify `apps/web/tests/terminal-schema.test.ts`, `terminal-attempts.test.ts`, `helpers/terminal-harness.mjs`, `helpers/payment-harness.mjs`; create `apps/web/tests/terminal-outcomes.test.ts`.

**Interfaces:** Add nullable `initiating_staff_id` to attempts, populated from authenticated `startTerminalAttempt` staff, never request JSON. Add integer `outcome_revision NOT NULL DEFAULT 0`, incremented transactionally on an actual stored status transition or new immutable observation, never a repeated read/reconciliation. New `TerminalOutcomeKind = 'approved'|'declined'|'canceled'`. Observation table holds stable ID, company/attempt/account, provider object identity, kind, provider timestamp and minimal safe summary; unique `(company_id,stripe_account,provider_object_id,kind)`. Acknowledgment table key `(company_id,staff_id,notice_id)`. Use attempt/company cascade and actor validation; do not add an unvalidated staff foreign key to an unindexed legacy schema.

- [ ] Write failing migration and ownership assertions:
  ```ts
  assert.equal(legacy.initiating_staff_id, null);
  assert.equal(created.initiating_staff_id, session.staffId);
  assert.equal(created.consent_staff_id, null); // non-save payment still has initiator
  assert.equal(observationsAfterRepeatedInstall, 0);
  assert.equal(orphanedRowsAfterCompanyDeletion, 0);
  ```
  Exercise repeated and competing installation, old-schema reads/writes after migration, and authenticated startup against migrated legacy fixtures.
- [ ] Run schema/attempts/outcomes suites and confirm RED.
- [ ] Implement repeatable additive migration with tenant/actor/unread lookup indexes, transaction-safe duplicate convergence and no historical insert. Preserve existing reservation/payment schema semantics. Staff deletion must remove personal acknowledgment/ownership visibility without destroying required original attempt recovery.
- [ ] Run targeted tests to PASS including concurrent startup and rollback-compatibility fixtures.
- [ ] Commit listed files as `feat: persist Terminal initiators and immutable outcome observations`.

### Task 2: Provider-verified immutable outcomes

**Files:** Modify `apps/web/src/lib/terminal-outcomes.ts`, `terminal-attempts.ts`, `apps/web/src/app/api/stripe/webhook/route.ts`; tests `apps/web/tests/terminal-outcomes.test.ts`, `terminal-attempts.test.ts`, `helpers/payment-harness.mjs`.

**Interfaces:** `observeTerminalOutcome(companyId:number, attemptId:string, evidence:{eventId?:string;chargeId?:string}): Promise<void>`. This function retrieves and validates evidence under the stored connected account and current environment. Webhook handler passes verified signed-event identity/failed Charge identity; reconciliation observes current verified facts. Public notice kind additionally supports `'attention'`, which is not a provider outcome.

- [ ] Write failing assertions:
  ```ts
  assert.deepEqual(kindsAfterDeclineDeclineSuccess, ['declined','declined','approved']);
  assert.equal(observationCountAfterConcurrentRedelivery, 3);
  assert.equal(canonicalPaymentCount, 1);
  assert.equal(declinesFromTimeoutOrSetupIntent, 0);
  assert.equal(observationsFromForeignOrMismatchedCharge, 0);
  ```
  Cover wrong account/mode/intent/metadata/amount/currency, non-card-present charge, paid or nonfailed charge, multiple charges per intent, canceled intent, and late failed-charge delivery after success. Preserve unresolved locks on observer failure.
- [ ] Run outcomes/attempts suites and confirm RED.
- [ ] Implement fresh binding validation and a safe whitelist of Charge receipt fields. Retrieve the individual failed Charge rather than relying on latest_charge; validate parent intent metadata but allow a later successful parent. Use provider IDs for semantic deduplication across webhook/reconciliation, not webhook ID alone. Observer failures remain retryable without duplicating canonical payment effects. Bound any Charge pagination and never silently certify incomplete historical evidence.
- [ ] Run targeted suites to PASS; webhook retries must converge after a database failure following canonical recording.
- [ ] Commit listed files as `feat: verify and deduplicate Terminal payment outcomes`.

### Task 3: Private notices and original-attempt recovery

**Files:** Create `apps/web/src/app/api/stripe/terminal/notices/route.ts`, `notices/[id]/ack/route.ts`, `apps/web/src/components/payments/TerminalNotices.tsx`; modify `apps/web/src/lib/terminal-outcomes.ts`, `native-terminal.ts`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/components/JobDetailClient.tsx`, `jobs/CheckoutModal.tsx`; create `apps/web/tests/terminal-notices.test.ts`, `terminal-notices-ui.test.ts`.

**Interfaces:** `listTerminalNotices(auth:{companyId:number;staffId:number|null}):Promise<{notices:TerminalNotice[]}>`; `acknowledgeTerminalNotice(auth:{companyId:number;staffId:number|null}, noticeId:string):Promise<void>`. `TerminalNotice` has `{id:string,attempt_id:string,job_id:number|null,kind:'approved'|'declined'|'canceled'|'attention',occurred_at:string,current_attempt_unresolved:boolean}` plus safe display summary. Attention identity is `attention:{attempt_id}:{outcome_revision}`; provider observations retain their own immutable IDs. GET is private/no-store and provider-free; POST uses existing same-origin mutation protections and authenticated initiator, never client recipient. Recovery URL is `/schedule/{jobId}?terminalAttempt={attemptId}`; non-job attempts use `/settings?tab=payments&terminalAttempt={attemptId}` and the existing save-card recovery surface, with the same authorization and no-automatic-mutation constraints.

- [ ] Write failing assertions:
  ```ts
  assert.equal(otherStaffNoticeCount, 0);
  assert.equal(unreadAfterHiddenMount, 1);
  assert.equal(unreadAfterExplicitVisibleAcknowledge, 0);
  assert.equal(unreadNewOutcomeAfterOldAck, 1);
  assert.equal(automaticPaymentMutationsFromDeepLink, 0);
  assert.equal(unresolvedReservationCountAfterAck, 1);
  ```
  Cover staff-null/deleted staff, foreign company/account, disabled rollout, invalid mode header not blocking provider-free recovery, account-switch stale fetch, offline display, repeated acknowledgment and forged/cross-origin POST. Deep links cannot select a foreign job/attempt.
- [ ] Run both new suites and confirm RED.
- [ ] Implement foreground/entry fetch with abort/epoch guards, no closed-app polling, explicit visible acknowledgment and prominent existing Card/Button styling. Show historical decline separately from current unresolved/success state. Original-attempt link only opens recovery; never automatically reconcile/confirm/cancel/collect. Preserve ordinary CheckoutModal ownership and unknown-attempt locks. Use a versioned opaque attention ID so acknowledgment cannot hide later unresolved transitions.
- [ ] Run targeted suites and existing terminal UI suites to PASS. Verify phone/desktop empty, loading, offline, new outcome and switched-account states.
- [ ] Commit listed files as `feat: show durable private Terminal outcomes on return`.

### Task 4: Confidential declined-transaction document and explicit sharing

**Files:** Create `apps/web/src/lib/terminal-declined-receipts.ts`, `apps/web/src/app/api/stripe/terminal/attempts/[id]/declines/[outcomeId]/route.ts`; modify `apps/web/src/components/payments/TerminalReceipts.tsx`, `native-terminal.ts`, `apps/mobile/ios/App/App/ForgeTerminalPlugin.swift`; create `apps/web/tests/terminal-declined-receipts.test.ts`, `terminal-declined-receipts-ui.test.ts`; modify native tests/registration and existing receipt tests as needed.

**Interfaces:** `getDeclinedTerminalDocument(companyId:number,attemptId:string,outcomeId:string):Promise<{filename:string;text:string}>`. Native bridge `shareDeclinedDocument({title:string,text:string}):Promise<{status:'shared'|'canceled'}>` creates only a bounded UTF-8 text attachment in app-private temporary storage and presents UIActivityViewController on the main thread, deleting the file after completion. No arbitrary file paths/URLs from JS. Browser downloads the same authenticated document as a Blob and revokes its URL.

- [ ] Write failing assertions:
  ```ts
  assert.match(document.text, /Declined transaction — not proof of payment/);
  assert.equal(receiptEmailUpdates, 0);
  assert.equal(paymentOrSavedCardWrites, 0);
  assert.equal(documentFromTimeoutOrSaveOnly, null); // route returns 409, not document
  assert.equal(deliveredMessageAfterShareCancellation, false);
  ```
  Cover later successful retry (historical decline stays accurately dated), bad safe fields/control characters, wrong tenant/account, stale logout response, activity-sheet failure/cancellation and no native path injection. Native test asserts one active share sheet, bounded payload, cleanup and iPad popover anchoring.
- [ ] Run new/approved-receipt suites and native runner; confirm intended RED.
- [ ] Implement fresh account/Charge verification on every generation; include merchant, amount/currency, provider timestamp, safe reference and available whitelisted card/EMV fields, never invented data or raw diagnostics. Label historical tap explicitly. No public URL, automatic email, financial mutation or delivered claim. Preserve approved Stripe-hosted receipt UI unchanged. Expose declined documents in original-attempt history, including multiple failed taps.
- [ ] Run full `npm test`, isolated `npm run build`, native tests and actual-SDK development build to PASS. Inspect share cancellation/success and browser download on isolated data. Document reopen-only delivery limitation in review evidence, not an Apple-compliance pass.
- [ ] Commit exact files as `feat: share verified declined Tap to Pay documents`.

## Completion boundary

Independent whole-branch review after all plans. No production migration/backfill/merge/enablement without separate approval. Text attachment is confidential only through authenticated access and explicit user-selected sharing; do not represent share-sheet presentation as delivery. Apple must still accept this receipt format and reopen-only notification behavior.
