# Tap to Pay Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer verified Stripe receipts after Tap to Pay and when reopening checkout, without retrying a charge.

**Architecture:** A receipt service reuses the existing attempt binding and exposes separate receipt routes. A checkout panel owns receipt-only state independently of Terminal collection. Reconciliation returns a provider-verified decline hint without changing lock semantics.

**Tech Stack:** Next.js, TypeScript, React, Stripe Connect, libSQL, node:test.

**Spec:** `docs/superpowers/specs/2026-09-26-tap-to-pay-receipts-design.md`

## Global Constraints

- No production enablement, external sends, database migration, owner role, merge, or physical-device action.
- Reuse existing primitives and tokens; receipts must never change payment locking or retry a charge.
- No stored recipient returned; `requested` and `test_only` are not delivery confirmations.
- Full web tests and build use disposable data; final independent review before opening the stacked PR.

## Review Focus

1. An old successful charge after refund must retain accurate refunded totals (Task 1 fixture).
2. An account or session changes during async work must not reveal stale receipt data or send to a stale recipient (Task 2 lifecycle tests).
3. Payment succeeded but receipt provider is down: leave payment confirmed and permit receipt retry without collection (Tasks 1 and 2).
4. Reopening checkout with Tap to Pay disabled or unsupported still allows prior receipts (Tasks 1 and 2).
5. A malicious/malformed provider URL or charge identity cannot escape binding (Task 1 table tests).

### Task 1: Verified receipt service and outcome hint

**Files:** Modify `apps/web/src/lib/terminal-attempts.ts`; create `apps/web/src/lib/terminal-receipts.ts`, `apps/web/src/app/api/stripe/terminal/receipts/route.ts`, `apps/web/src/app/api/stripe/terminal/attempts/[id]/receipt/route.ts`; tests in `apps/web/tests/terminal-receipts.test.ts` and helper `apps/web/tests/helpers/terminal-harness.mjs`.

**Interfaces:** Consumes existing Terminal auth, environment and bound-attempt retrieval. Produces `listTerminalReceipts(companyId:number,jobId:number)`, `getTerminalReceipt(companyId:number,id:string)` and `requestTerminalReceipt(companyId:number,id:string,email:unknown)`. Receipt view: `{attempt_id,amount_cents,refunded_cents,created,receipt_url,test_mode}`; POST returns `{status:'requested'|'test_only'}`. List `{receipts:[{attempt_id,amount_cents,created_at}]}`. Attempt view gains optional `payment_declined:boolean` populated from fresh provider state only.

- [x] Write failing route/service tests: successful GET contains only approved fields; POST updates only receipt_email with connected-account/idempotency options; unauthorized/cross-tenant/same-origin/invalid email reject without update; unknown/setup/pending/failed/mismatched/uncaptured/mode-mismatched charges reject; URL allowlist; history tenant-scoped and DB-only; refund preserved; repeated email key stable; rollout-off supported; provider errors do not change payments; decline hint not cancellation/success/unknown.
- [x] Run `node --no-warnings --experimental-strip-types --test tests/terminal-receipts.test.ts` from apps/web. Expected: missing receipt methods/routes or assertions fail before implementation.
- [x] Implement service/routes and verified decline hint per spec. Keep receipt error copy distinct from financial-reconciliation errors.
- [x] Run full `npm test`. Expected: all pass. Compare exact provider arguments and payment counts in tests, not only HTTP status.
- [x] Commit Task 1 with its tests. Run task-done with full web suite.

### Task 2: Checkout receipt UI, reopening, and visual verification

**Files:** Create `apps/web/src/components/payments/TerminalReceipts.tsx`, `apps/web/tests/terminal-receipts-ui.test.ts`; modify `CheckoutModal.tsx`, `TerminalFlow.tsx`, `tests/terminal-ui.test.ts`.

**Interfaces:** Consumes Task 1 receipt APIs. `TerminalReceipts({jobId:number, latestAttemptId?:string, native?:Pick<NativeTerminal,'generation'>})` lists/selects a receipt and explicitly requests email. Checkout passes the latest successful payment ID; TerminalFlow renders decline hint but retains existing unfinished-attempt controls.

- [x] Write failing real-handler tests for initial empty/disabled history, latest success selection, history reopen selection, email validation/send/test copy, repeated-click locking, error preserves email/no collection, stale job/unmount/generation and merchant identity responses ignored, URL links safe, and decline text/control behavior.
- [x] Run receipt UI and Terminal UI tests. Expected: missing component or asserted behavior fails.
- [x] Implement panel with Button/Input/Label and existing tokens; hook into checkout success without modifying financial callbacks/locks. Keep no-charge setup flow receipt-free.
- [x] Run full `npm test`. Expected: all pass. Run disposable-DB `npm run build`. Expected: exit 0.
- [x] Render phone-width success/test/error/history fixtures and inspect screenshots. Preview remains fake; it is not delivery/NFC proof.
- [x] Commit Task 2; task-done full suite; final branch review and one tested fix pass. Push/open PR stacked on `feature/tap-to-pay-test-safety`, attach, do not merge.

## Self-review

Service field names, route paths, UI props, lifecycle guards and test obligations agree with the spec. Existing delegated self-review permits inline execution; no external approval gate is bypassed.

## Execution evidence

Completed on September 26, 2026. Task 1 commit `8e2d5f8`; Task 2 `2987f25`; review fix `d766563`. Full suite 622 passing; disposable-DB production build passed. Independent review found one Important error-copy issue, reproduced and fixed with two regression tests; no second independent review of the fix. Pending-send lifecycle test expansion remains a deferred Minor. [PR 375](https://github.com/nickpgaines/software/pull/375) is open, stacked on PR 374; not merged or enabled. Physical/provider/Apple gates remain open as described in the spec.
