# Tap to Pay Reader Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely prepare an eligible reader on launch/foreground and reuse it at checkout without surprise prompts.

**Architecture:** The native coordinator remains the exclusive reader owner. Separate operation cleanup from reader teardown, bind idle readiness to the pinned session, and expose one authenticated web lifecycle controller to Settings and checkout.

**Tech Stack:** Swift, Stripe Terminal iOS SDK, Capacitor, TypeScript/React, Next.js, existing standalone native and Node test harnesses.

**Spec:** `docs/superpowers/specs/2026-09-26-tap-to-pay-readiness-design.md` and shared `2026-09-26-tap-to-pay-review-gaps-design.md`.

## Global Constraints

- No APNs, native push permission prompts, push credentials, new push provider, automatic operational email, or SMS notifications.
- No production enablement, deployment, live transactions, Apple terms acceptance, account unlinking, Apple submission, or customer announcement delivery in this work. Payment/auth merges require separate approval.
- Unknown or changed identity fails closed. No persisted readiness or terms flag is authoritative.
- Automatic warm-up never displays terms, education, permission prompts or payment UI.
- Release ignores test origin/simulation overrides. Do not change production signing.
- Read `DESIGN_SYSTEM.md` completely before UI work; use existing tokens and primitives.

## Review Focus

1. Permission undetermined on fresh install: automatic warm-up must not prompt (Task 1).
2. A stale warm-up callback after account change must not restore readiness (Task 1).
3. Background during confirmation must preserve unknown-payment recovery (Task 2).
4. Checkout colliding with warming must wait without a second reader or attempt (Task 2).
5. Old bridge/disabled rollout must not break manual entry or existing recovery (Task 3).

## Execution conventions

Run web commands from `apps/web` using the available Node 24 runtime. Native tests run from repository root: `bash apps/mobile/ios/App/ForgeWidgetTests/run-terminal-tests.sh`. Use `/usr/bin/git`; stage only listed files. Tests below use existing fake-reader/harness conventions; extend those fakes rather than mocking the coordinator being tested.

### Task 1: Authoritative, noninteractive readiness

**Files:** Modify `apps/mobile/ios/App/App/ForgeTerminalCoordinator.swift`, `ForgeTerminalSession.swift`, `ForgeTerminalSessionPolicy.swift`, `ForgeTerminalReader.swift`, `ForgeTerminalPlugin.swift`; modify `apps/web/src/app/api/stripe/terminal/connection-token/route.ts`; tests `apps/mobile/ios/App/ForgeWidgetTests/ForgeTerminalTests.swift`, `TerminalTestMain.swift`, `apps/web/tests/terminal-attempts.test.ts`.

**Interfaces:** Extend `TerminalSessionPurpose` with `.warmup` (never grants terms permission). Add `TerminalAccountLinkStatus` (`accepted`, `setupRequired`, `unavailable`) and `TerminalReadinessState` (`disconnected`, `warming`, `ready`, `collecting`, `cleaning`). Reader protocol produces `accountLinkStatus() async -> TerminalAccountLinkStatus` and `canWarmWithoutPrompt: Bool`; coordinator produces `warmUp(account: String, location: String) async throws -> TerminalReadinessState`. Existing session context UUID/cookie/account plus validated location/environment form the binding; do not expose cookies to JS.

- [ ] Write failing tests in the existing fake reader/session harness, exposing counters and controllable completions as needed:
  ```swift
  XCTAssertEqual(reader.connectCalls, 0) // permission undetermined, or link false/unknown
  XCTAssertEqual(reader.termsRequests, 0) // every automatic warm-up path
  XCTAssertEqual(reader.educationCalls, 0)
  XCTAssertEqual(coordinator.readiness, .disconnected) // old callback after session reset
  XCTAssertEqual(reader.connectCalls, 1) // duplicate eligible warmUp calls
  ```
  Server tests assert a warmup token has `tos_acceptance_permitted === false`, representative-confirmed warmup is rejected, and a changed account/withdrawn rollout cannot mint a token.
- [ ] Run native runner and `node --no-warnings --experimental-strip-types --test tests/terminal-attempts.test.ts`; confirm failures are missing behavior, not harness errors.
- [ ] Implement the interfaces. Use actual SDK `isTapToPayAccountLinked(_:completion:)` with the account-scoped token context; verify its argument semantics against installed headers/current Stripe docs. Check existing OS authorization status without requesting it. Unknown permission or linking status stops automatic connection. Revalidate session before and after SDK callbacks. Add warmup purpose to strict server header parsing; preserve preparation-only fresh representative authorization.
- [ ] Run both targeted suites to PASS; register every new standalone native test in `TerminalTestMain.swift`.
- [ ] Stage these files and commit `feat: add noninteractive Terminal readiness checks`.

### Task 2: Atomic idle-reader handoff and bounded teardown

**Files:** Modify `apps/mobile/ios/App/App/ForgeTerminalCoordinator.swift`, `ForgeTerminalReader.swift`, `ForgeTerminalPlugin.swift`, `ForgeTerminalSession.swift`; test `apps/mobile/ios/App/ForgeWidgetTests/ForgeTerminalTests.swift`, `TerminalTestMain.swift`.

**Interfaces:** Reader protocol gains `clearOperation() async throws` (drain operation callbacks and clear intent/card references, without disconnecting idle reader); existing `cleanUp()` remains full teardown. Coordinator readiness from Task 1 is authoritative; existing collection/preparation signatures remain compatible. Runtime background, URL/cookie reset and explicit reset consume full teardown, not operation cleanup.

- [ ] Add failing assertions for a matching warmed reader, changed binding, blocked warm-up, cleanup failure and background during confirmation:
  ```swift
  XCTAssertEqual(reader.connectCalls, 1) // warm + matching collection reuses one connection
  XCTAssertEqual(reader.maximumConcurrentOperations, 1)
  XCTAssertFalse(reader.hasRetainedIntent) // before returning ready
  XCTAssertNotEqual(coordinator.readiness, .ready) // failed cleanup/unknown confirmation
  XCTAssertEqual(reader.confirmCalls, 1) // late callback/foreground never retries confirmation
  ```
  Add explicit mismatched account/location/mode/cookie tests and education-only ownership tests. Cancellation must drain before another reader owner is admitted.
- [ ] Run native runner and observe failures.
- [ ] Implement exclusive transition/handoff: join matching warm-up, freshly validate authorization, atomically enter collecting; never create/retry an intent here. Retain idle only after successful operation cleanup and fresh same-session foreground validation. Uncertain confirmation and failed drain retain existing locked recovery behavior. Keep initial preparation education and explicit How to Tap; do not educate on ordinary collection. Record only monotonic duration/outcome labels for button-to-reader timing, with no identifiers/secrets/card data.
- [ ] Run native runner to PASS and compile against the real SDK in an isolated development copy using the existing signed-device build procedure. A host-only fake-reader test is not SDK compilation evidence.
- [ ] Stage listed files and commit `feat: safely reuse foreground Terminal reader connections`.

### Task 3: One authenticated readiness controller

**Files:** Create `apps/web/src/components/payments/TerminalLifecycle.tsx`; modify `apps/web/src/lib/native-terminal.ts`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/components/payments/TerminalSetup.tsx`, `TerminalFlow.tsx`; tests create `apps/web/tests/terminal-lifecycle.test.ts`, modify `native-terminal.test.ts`, `terminal-setup-ui.test.ts`, `terminal-ui.test.ts`.

**Interfaces:** Native bridge adds `warmUp({operationId,stripeAccount,locationId}): Promise<{state:string}>` with `warmupSupported` capability and an operation-scoped readiness listener. `TerminalLifecycleProvider` exports `useTerminalReadiness(): {state:'checking'|'setupRequired'|'preparing'|'ready'|'unavailable'; refresh:()=>Promise<void>}`. Controller consumes fresh `/capabilities`, company and `/location` responses with existing environment validation; server/native authorization still governs every operation.

- [ ] Write controller/bridge behavioral tests with controlled fetches and foreground events:
  ```ts
  assert.equal(warmCalls.length, 1); // duplicate foreground events
  assert.equal(warmCalls.length, 0); // browser, old bridge, rollout off, no location: separate cases
  assert.notEqual(screenState, 'ready'); // delayed response after account/session change
  assert.equal(paymentCreates, 0); // lifecycle activation alone
  assert.equal(manualEntryAvailable, true); // unsupported warm-up; existing unknown locks still apply
  ```
  Test unmount/listener cleanup and no timer/provider actions while backgrounded. Test Settings setupRequired versus unavailable copy and initialization/processing indicator continuity.
- [ ] Run targeted four web suites and confirm RED.
- [ ] Implement provider once under the authenticated shell, debounced foreground refresh and epoch-based stale response suppression. Settings and checkout consume it, not parallel warm-up loops. Keep manual fallback and explicit preparation/education actions; reset on trusted-session changes and server rollout/account/location invalidation. A JS ready state never bypasses native/server validation.
- [ ] Run targeted suites, full `npm test`, and an isolated `npm run build` to PASS; native runner must still pass. Inspect changed states at phone/desktop light/dark widths and in the isolated signed test app. Request device testing with current Central time. Do not claim the one-second/90% target without actual physical measurements.
- [ ] Stage listed files and commit `feat: expose shared Tap to Pay readiness in authenticated UI`.

## Completion boundary

Whole-branch independent review after all three plans; fix blockers and rerun affected/full checks. No push until production web build passes; push feature branch only, with separately approved payment/auth merge. Physical NFC latency remains an explicit external gate, not a simulated-test pass.
