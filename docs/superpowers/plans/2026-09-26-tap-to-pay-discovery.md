# Tap to Pay Discovery and Launch Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guide eligible merchants to setup and prepare gated launch messaging without sending it.

**Architecture:** Reuse Payments settings and existing card/modal primitives. A separate server content gate and per-company/staff/version acknowledgment control announcements; shared reader/recovery busy state defers them. Launch drafts and a read-only audience count do not create delivery infrastructure.

**Tech Stack:** React/Next.js, TypeScript, SQLite/libSQL, existing Capacitor capability checks.

**Spec:** `docs/superpowers/specs/2026-09-26-tap-to-pay-discovery-design.md` and shared `2026-09-26-tap-to-pay-review-gaps-design.md`.

## Global Constraints

- No APNs, native push permission prompts, push credentials, new push provider, automatic operational email, or SMS notifications.
- No production enablement, deployment, live transactions, Apple terms acceptance, account unlinking, Apple submission, or customer announcement delivery in this work. Payment/auth merges require separate approval.
- Use "Tap to Pay on iPhone" consistently. No custom Apple logo or improvised contactless artwork.
- Approved marketing toolkit assets/copy are an external prerequisite for final launch content.
- No announcement or readiness claim appears just because code is deployed. Production announcement remains off.
- No send/schedule/bulk-send endpoint. Read full `DESIGN_SYSTEM.md` before UI changes.

## Review Focus

1. Forged onboarding-return query must not imply merchant eligibility (Task 1).
2. Announcement must not interrupt collection, recovery or a critical modal (Task 2).
3. Account switching and late acknowledgments must not cross staff/version boundaries (Task 2).
4. Future content accidentally enabled without approved assets must stay hidden (Task 2).
5. Recipient preview must not leak contact details or invoke a delivery provider (Task 3).

### Task 1: Verified onboarding-to-setup route

**Files:** Modify `apps/web/src/app/api/stripe/connect/return/route.ts`, `apps/web/src/components/payments/TerminalSetup.tsx`; create `apps/web/tests/terminal-onboarding.test.ts`; modify `apps/web/tests/terminal-setup-ui.test.ts` and existing Stripe test harness.

**Interfaces:** Preserve server return redirect `/settings?tab=payments`; no URL flag authorizes setup. Reuse readiness provider `refresh():Promise<void>` from readiness plan plus fresh Stripe account/location checks. Return sync errors leave unavailable/incomplete state, not approved state.

- [ ] Write failing assertions:
  ```ts
  assert.equal(setupActionVisible, false); // forged success URL + incomplete provider status
  assert.equal(requirementsActionVisible, true); // verified incomplete onboarding
  assert.equal(setupActionVisible, true); // verified eligible native merchant + rollout
  assert.equal(automaticPrepareOrTermsCalls, 0); // any return URL
  ```
  Test old/native-unsupported clients, disabled rollout, provider sync failure and account change while refresh is pending; normal manual card flow remains available.
- [ ] Run onboarding/setup suites from `apps/web` with `node --no-warnings --experimental-strip-types --test tests/terminal-onboarding.test.ts tests/terminal-setup-ui.test.ts`; confirm RED.
- [ ] Implement explicit "Set up Tap to Pay" route within existing Payments UI; reuse verified readiness and existing requirements display. No automatic reader terms/preparation from redirect.
- [ ] Run targeted suites to PASS.
- [ ] Stage exact files; commit `feat: guide eligible Stripe merchants to Tap to Pay setup`.

### Task 2: Separately gated, versioned announcement

**Files:** Create `apps/web/src/lib/terminal-announcements.ts`, `apps/web/src/app/api/stripe/terminal/announcement/route.ts`, `announcement/ack/route.ts`, `apps/web/src/components/payments/TerminalAnnouncement.tsx`; modify `apps/web/src/lib/terminal-schema.ts`, `apps/web/src/components/payments/TerminalLifecycle.tsx`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/components/jobs/CheckoutModal.tsx`; create `apps/web/tests/terminal-announcement.test.ts`, `terminal-announcement-ui.test.ts`; modify schema tests.

**Interfaces:** `getTerminalAnnouncement(auth:{companyId:number;staffId:number|null}):Promise<{announcement:null|{version:string;title:string;body:string}}>` and `acknowledgeTerminalAnnouncement(auth,version:string):Promise<void>`. Store unique company/staff/version acknowledgment. New `TAP_TO_PAY_ANNOUNCEMENT_ENABLED` requires exact `true`, defaults false; additionally require server rollout, verified merchant eligibility and a reviewed content manifest marked approved (default absent). Client additionally requires supported native capability. Lifecycle exposes `acquirePresentationBlock():()=>void`; checkout/recovery/critical-modal owners acquire/release a reference-counted block. Announcement cannot seize an existing modal; inspect current global modal conventions before wiring this arbitration.

- [ ] Write failing assertions:
  ```ts
  assert.equal(announcement, null); // rollout false, content flag false, or no approved manifest: separate cases
  assert.equal(visibleAnnouncementCount, 0); // any critical modal, collection or recovery active
  assert.equal(visibleAnnouncementCount, 1); // duplicate eligible foreground responses
  assert.equal(otherStaffOrVersionAcknowledged, false);
  assert.equal(providerDeliveryCalls, 0);
  ```
  Test nested presentation locks, stale responses after logout, unsupported native bridge, repeated visits, explicit Not now/Setup acknowledgment, forged/cross-origin POST, legacy/concurrent schema install and company/staff deletion cleanup.
- [ ] Run new suites and schema tests; confirm RED.
- [ ] Implement existing dialog/card UI with "Set up Tap to Pay" and "Not now". Both explicit actions acknowledge only the displayed version; setup navigates to Payments settings. Mounted/hidden UI never acknowledges. Integrate current critical modal owners with the block contract; do not replace hand-rolled fixed wrappers. Keep persistent Settings entry point. Placeholder text exists only in tests/local preview, never treated as approved marketing content. No Apple imagery until approved assets are supplied.
- [ ] Run targeted suites to PASS; inspect phone/desktop, light/dark and default/custom accent with fake approved content in the isolated environment. Verify fresh/returning merchants and deferred presentation after recovery dismissal.
- [ ] Stage exact files; commit `feat: prepare gated Tap to Pay launch announcement`.

### Task 3: Launch drafts, read-only audience preview and release evidence

**Files:** Create `docs/tap-to-pay-launch-drafts.md`, `apps/web/scripts/terminal-announcement-audience.ts`, `apps/web/tests/terminal-announcement-audience.test.ts`.

**Interfaces:** `countTerminalAnnouncementAudience(db:ReadonlyAudienceDb):Promise<{eligibleCompanies:number;eligibleStaff:number;missingContact:number}>`, where `ReadonlyAudienceDb` exposes `select<T>(sql:string,params:ReadonlyArray<string|number|null>):Promise<T[]>`; its adapter rejects non-SELECT statements and opens SQLite read-only. CLI requires explicit read-only database selection; default to disposable fixtures. Audience rules: active valid staff membership, charging-enabled connected merchant, configured valid location, deduplicated staff/company; native-device support remains unknown until the app opens. Counts are a candidate audience, not proof of Apple setup/readiness or permission to email.

- [ ] Write failing assertions against mixed eligible/foreign/deleted/duplicate fixtures:
  ```ts
  assert.deepEqual(result, {eligibleCompanies:1,eligibleStaff:2,missingContact:1});
  assert.equal(writeStatements.length, 0);
  assert.equal(outboundProviderCalls.length, 0);
  assert.equal(outputContainsEmailOrCustomerIdentifiers, false);
  ```
- [ ] Run audience suite; confirm RED.
- [ ] Implement count-only preview and draft email/in-app copy with explicit NOT APPROVED / DO NOT SEND labels, approved-toolkit placeholders and owner review checklist. Include no-push Apple clarification, receipt-format acceptance, three recordings, real NFC test cards/supported released iOS and publishing entitlement as outstanding gates. Do not access production for audience counting without a separate scoped request.
- [ ] Run audience suite, full `npm test`, isolated `npm run build`, native runner and final development build to PASS. Confirm source/default config still disables announcements and production Tap to Pay. Perform independent whole-branch review across all three plans; fix blockers before requesting merge approval. Save honest verification evidence separating simulated checks from physical/release gates.
- [ ] Stage exact files; commit `docs: prepare Tap to Pay launch drafts and audience preview`. Push feature branch only after passing build; do not merge/deploy/send.

## Self-review and execution order

Execute readiness → outcomes → discovery. Each has separate test gates and commits. Coverage maps to all three specs; recovery survives rollout-off, outcome identities survive later success, announcement approval is independent of code deployment, and no native push infrastructure is introduced. External Apple/marketing/physical-device gates remain explicitly incomplete. Plans require user approval/execution-method selection before product implementation.
