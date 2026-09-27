# Tap to Pay Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit merchant/location/device setup to the existing Tap to Pay integration without a charge or production activation.

**Architecture:** A shared account-scoped location service replaces lazy placeholder creation. Native preparation uses the existing exclusive coordinator and a server-authorized token purpose; Settings consumes these interfaces and operation-scoped progress.

**Tech Stack:** Next.js, libSQL, Stripe Node, Capacitor, Swift, Stripe Terminal 5.8.0.

**Spec:** `docs/superpowers/specs/2026-09-26-tap-to-pay-setup-design.md`

## Global Constraints

- Existing `settings.view_all` permission; no Owner role.
- `TAP_TO_PAY_ENABLED` must be exactly `true` for new work; leave production configuration unchanged.
- US locations only; no placeholder addresses or implicit location creation.
- No real payment, Apple terms acceptance, upload, provisioning or public activation.
- Reuse existing UI primitives and tokens; preserve recovery and manual card entry.

## Review Focus

- A role or connected account changes while setup is awaiting Stripe: no stale selection grants cross-account use (Task 1/2).
- Old native builds lack preparation: useful fallback, no broken manual payments (Task 3).
- Multiple valid locations or provider failure: require explicit selection / retry, never invent a location (Task 1).
- Logout/cancel during a terms or configuration screen: stale callback cannot finish another operation (Task 2).
- An employee supplies representative=true without permission: server rejects; collection never displays terms (Task 2).

### Task 1: Account-scoped merchant location setup

**Files:** Create `apps/web/src/lib/terminal-location.ts`, `apps/web/tests/terminal-location.test.ts`; modify terminal location route, `terminal-attempts.ts`, `stripe.ts`, and `tests/helpers/terminal-harness.mjs`.

**Interfaces:** `resolveTerminalLocation(db:Db, companyId:number, stripeAccount:string):Promise<Stripe.Terminal.Location>` for both legacy and durable checkout. `getTerminalLocationSetup(session:SessionContext)` returns `{stripe_account,can_manage,locations,selected_location_id,has_more}`. `saveTerminalLocationSetup(session:SessionContext,body:unknown)` accepts exactly `{location_id}` or `{display_name,address:{line1,line2?,city,state,postal_code,country:'US'}}` and returns `{location_id,display_name,stripe_account}`.

- [ ] Write route tests asserting GET cannot create/persist locations, unauthorized/cross-origin/rollout-off POST has no effects, valid scoped select/create persists the location, invalid and ambiguous locations fail, account change during provider response cannot persist, and duplicate create uses the same account-scoped idempotency key.
- [ ] Run `node --no-warnings --experimental-strip-types --test tests/terminal-location.test.ts` in apps/web; expected failures for the existing lazy endpoint and absent POST.
- [ ] Implement service and route. Extract the durable resolver and have the legacy helper delegate to it; preserve its return contract. Validate complete address and real US state codes. Distinguish Stripe resource_missing from outages.
- [ ] Run new tests plus `tests/terminal-attempts.test.ts`; expected all pass. Run full `tests/*.test.ts`; expected all pass.
- [ ] Commit the verified backend slice.

### Task 2: Authorized native preparation and reader progress

**Files:** Modify connection-token route, native-terminal.ts, ForgeTerminalPlugin/Coordinator/Reader/Session/SessionPolicy/ReaderEvents.swift and their existing web/native tests.

**Interfaces:** `prepareDevice({operationId,stripeAccount,locationId,representativeConfirmed}):Promise<void>`. Native session purpose is `collection` or `preparation`; representative confirmation is sent only with preparation. Token response contains server-authorized `tos_acceptance_permitted:boolean`; native collection ignores/forbids true. Native event `terminalProgress` carries `{operationId,phase,message,progress?}`.

- [ ] Write failing token tests: nonmanager cannot authorize terms, missing confirmation denies terms, collection stays false, revoked role/account fails refresh, rollout blocks every path.
- [ ] Add token-purpose authorization using current strict permissions. No persistent agreement status; Apple/Stripe remain authoritative.
- [ ] Write failing native tests: preparation connects and educates but never retrieves/collects/confirms; ordinary collection forbids terms; cancellation and old callbacks cannot revive operation; token authorization cannot cross session/purpose.
- [ ] Extend coordinator/session/provider contracts and bridge. Explicitly set SDK terms permission from authorized preparation only. Add scoped progress and topmost presenter. Preserve all cleanup protections.
- [ ] Run web suite, `sh apps/mobile/ios/App/ForgeWidgetTests/run-terminal-tests.sh`, Simulator build and unsigned opt-in device build; expected pass. Commit.

### Task 3: Settings setup and checkout handoff

**Files:** Create `apps/web/src/components/payments/TerminalSetup.tsx`; modify `SettingsTabs.tsx`, `TerminalFlow.tsx`, native-terminal.ts and payment UI tests.

**Interfaces:** Consume Task 1 location API and Task 2 preparation/events. Keep server reconciliation as the only payment-success authority.

- [ ] Read DESIGN_SYSTEM.md; write failing rendered UI tests for unauthorized confirmation, legacy bridge fallback, location selection/address validation, progress, cancel/account-change and setup-required checkout handoff.
- [ ] Add setup card using current primitives, existing permissions and explicit confirmation. How to Tap remains independently discoverable. Use text-only checkout branding and normal card fallback.
- [ ] Run full web/native suites and production build; expected pass. Render desktop/mobile and simulator, inspect loading/error/ready screens. Do not claim physical-reader acceptance.
- [ ] Commit; request independent whole-branch review, address blocking findings with regression tests, push and open PR. Await explicit merge approval.

## Self-review

Spec and plan retain all setup requirements. Receipt offers, isolated test configuration and external Apple gates remain explicit follow-on work rather than being treated as complete. Shared location field names and native operation IDs are consistent across tasks. Implement inline under the user's existing instruction to self-review the spec and proceed without another design review.
