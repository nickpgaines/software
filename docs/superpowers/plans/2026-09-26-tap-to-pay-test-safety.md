# Tap to Pay Test Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely target an isolated Stripe test environment from Debug without widening Release trust.

**Architecture:** Native configuration pins origin and provider mode. Terminal server boundaries validate mode and credentials before effects; web requests carry the native expectation.

**Tech Stack:** Swift/XCTest, TypeScript/Next.js, node:test, Stripe Terminal 5.8.0.

**Spec:** docs/superpowers/specs/2026-09-26-tap-to-pay-test-safety-design.md

## Global Constraints
- Production rollout stays off; no real provider effects or signing changes.
- Release stays at https://www.forgecrm.app with live mode and no simulated reader.
- Test origins require HTTPS and may not be forgecrm.app or its subdomains.
- Current checkout, follow-on branch from fc383716; preserve PR373 and unrelated files.
- Reconciliation remains available when rollout is disabled and credentials match.

## Review Focus
- Cached Stripe client initialized with a different key: reject instead of misreporting mode (Task 1).
- Mode mismatch on location or payment creation: zero external effects (Task 1).
- Invalid test override or simulation without override: fail closed, no production fallback (Task 2).
- Cookie/account changes during asynchronous response: no token delivered (Task 2).
- Logout during web capability lookup: no delayed mutation (Task 3).

### Task 1: Server mode validation
**Files:** lib/stripe.ts, new lib/terminal-environment.ts, lib/terminal-http.ts, terminal-rollout.ts, terminal-location.ts, terminal-attempts.ts, connection-token route; tests/terminal-environment.test.ts and helper terminal-harness.mjs (all under apps/web).
**Interfaces:** `requireTerminalEnvironment(expected?:string|null): 'test'|'live'`; `getStripeCredentialMode(): 'test'|'live'|null`. Existing token response gains `provider_mode`.
- [ ] Add route/service tests: mismatched keys or declared mode => 409/503 and zero intents/tokens/locations; explicit test config succeeds and returns test; missing mode defaults live and rejects test keys; cached key drift fails; rollout-off reconciliation succeeds.
- [ ] Run `node --experimental-strip-types --test tests/terminal-environment.test.ts`; expect RED assertions against missing guards.
- [ ] Implement configuration validation before provider effects. Limit HTTP enforcement to /api/stripe/terminal/ paths with a declared expectation; retain existing auth/CSRF ordering. Add service validation for direct/new and recovery paths, never gate recovery on rollout.
- [ ] Run `npm test`; expect all pass. Commit server guards.

### Task 2: Native isolated configuration
**Files:** apps/mobile/ios/App/App/ForgeTerminalSessionPolicy.swift, ForgeTerminalSession.swift, ForgeTerminalReader.swift, ForgeTerminalPlugin.swift; ForgeWidgetTests/ForgeTerminalTests.swift.
**Interfaces:** `TerminalEnvironment.resolve(environment:[String:String],debugBuild:Bool) -> TerminalEnvironment?`; immutable `origin`, `endpoint`, `providerMode`, `simulated`; `TerminalSessionPolicy.configuration` uses compile-time DEBUG; policy methods accept configuration defaulting to runtime. ForgeTerminalSession initializer captures configuration.
- [ ] Add tests for accepted isolated HTTPS origin, invalid origin/simulation-without-origin refusal, Release ignoring overrides, test cookie isolation, request expectation and test response refusing absent/live mode.
- [ ] Run `sh apps/mobile/ios/App/ForgeWidgetTests/run-terminal-tests.sh`; expect RED for absent configuration API.
- [ ] Implement immutable configuration and wire plugin/session/reader; preserve existing lifecycle protections. Capabilities return providerMode.
- [ ] Run standalone native suite; expect all pass. Commit native boundary.

### Task 3: Web propagation and integrated verification
**Files:** apps/web/src/lib/native-terminal.ts, components/payments/TerminalFlow.tsx, TerminalSetup.tsx; native-terminal and component tests; docs test instructions.
**Interfaces:** `terminalRequestInit(native:Pick<NativeTerminal,'generation'|'capabilities'>,url:string,init?:RequestInit):Promise<RequestInit>` carries mode only to relative Terminal routes, preserves headers, rejects generation changes. Capability providerMode is optional for older live native builds.
- [ ] Add tests asserting mode headers preserved with content type, no header on non-Terminal endpoints, and logout during capability read prevents fetch. Test actual setup and checkout requests carry test mode.
- [ ] Run focused web tests; expect RED from missing propagation.
- [ ] Implement helper and call before component fetch, preserving existing lifecycle checks.
- [ ] Run full web suite, production build against disposable SQLite, standalone native tests, unsigned Debug simulator and opt-in Release builds; expect success.
- [ ] Document exact non-sensitive flags versus sensitive keys, fake DB requirement and limitations; commit. Obtain one independent review, resolve important findings with RED→GREEN, push follow-on PR without merging.
