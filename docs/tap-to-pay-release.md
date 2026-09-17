# Forge Tap to Pay release handoff

Tap to Pay is locally implemented across the server, iOS bridge and web UI. Local automated evidence is suitable for code review, but it is not release acceptance. Do not deploy, enable signing capabilities, contact Stripe or Apple accounts, run a provider intent, charge a card, upload a build or roll out the feature without separate authorization.

## Cross-layer contract checked

- Server attempt creation owns the amount, customer/company/account, consent, Terminal location, provider identity and durable idempotency. The browser supplies `operation`, the job or customer ID, save choice and versioned consent; it never supplies an amount or connected-account authority.
- `TerminalAttemptView` passes `attempt_id`, `operation`, `status`, `stripe_account`, `terminal_location_id`, optional resumable `client_secret`, `amount_cents`, customer/job IDs, save choice and the separate `payment_recorded`, `card_saved` and `warning` outcomes to the web flow.
- Web passes native `operationId`, `clientSecret`, `stripeAccount`, `locationId` and `saveCard` with the exact camelCase bridge names. Native returns only `intentId`; the browser always reconciles the server attempt before reporting success.
- Native accepts only the current secure `crm_session` for `https://www.forgecrm.app`, posts to the fixed connection-token endpoint with fixed Origin and matching `X-Forge-Stripe-Account`, rejects redirects/account changes and clears reader credentials between operations.
- Unsupported/old native builds retain manual card entry. Native cancellation, backgrounding, navigation, logout and unknown confirmation all preserve the server attempt for recovery; none authorizes creating a replacement charge.
- Terminal generated cards are saved as explicit-selection-only. Saving never changes the customer default, starts a subscription or feeds an implicit job/subscription fallback. Accepted/signed subscriptions may explicitly select the Forge saved-method row; the selected Stripe method is forwarded without changing customer defaults.
- A SetupIntent carrying `terminal_attempt_id` is reconciled by the Terminal path and saves only its `latest_attempt.card_present.generated_card`. An ordinary SetupIntent uses its ordinary `payment_method`. Persistence failures return a retryable webhook failure and do not retain the event claim.

## Evidence and limits

The local suite uses real in-memory SQLite for route/service behavior and doubles only external provider, native bridge and HTTP boundaries. It exercises same-origin/session checks, account remapping, old-app fallback, duplicate taps, cancel/unknown recovery, partial payment/save success, logout/unmount races, generated-card isolation, signed subscription selection and ordinary-versus-Terminal webhook dispatch. Recovery regressions additionally cover USD amount bounds before reservation, narrow definitive no-intent rejection without stranding the job, preservation of ambiguous outcomes and concurrent success, and payment/setup recovery after charging eligibility is disabled while new creation remains blocked.

Native host tests execute production coordinator/session/policy code without a provider account. The actual app and test bundle compiled against Stripe Terminal iOS SDK **5.8.0**. The enabled-capability Release simulator branch and unsigned physical-device Release branch compiled. See `/private/tmp/forge-terminal-review1-test-build.log` and `/private/tmp/forge-terminal-device-compile.log`; compilation does not prove signing, runtime or reader behavior.

Local verification snapshot on 2026-09-16:

- Node.js 24.19.0, npm 9.2.0 and Next.js 14.2.35: 308/308 web tests passed; `tsc --noEmit` passed. The preceding isolated-file SQLite production build compiled and generated 149/149 static pages; the final recovery-fix build and scoped re-review are pending.
- Xcode 27.0 (27A266a), Apple Swift 6.4: 13/13 native macOS behavioral tests passed.
- Retained actual-SDK logs show `TEST BUILD SUCCEEDED` for the Debug simulator app/test bundle and `BUILD SUCCEEDED` for the enabled-capability Release simulator and unsigned generic-device branches. Existing third-party Capacitor and Splash asset warnings remain; no clean-warning claim is made.

The following remain deliberately unverified:

- XCTest execution on a booted simulator; no simulator was booted automatically.
- Representative full UI layout/interaction on a simulator or physical device. Existing coverage is the React hook/component harness, so no visual acceptance claim is made.
- SDK simulated-reader runtime, because no isolated provider test environment is configured.
- Restricted entitlement approval, signed provisioning profiles, Apple merchant education/Terms presentation, location/permission UI, NFC acceptance, physical cards/wallets, declines, settlement and production operations.

## Required isolated provider-test environment

Current native code trusts only the production `https://www.forgecrm.app` origin and fixed production token URL, while Stripe mode is selected by deployment-wide keys. `FORGE_TERMINAL_SIMULATED=1` changes the SDK reader only; it does not switch Stripe to test mode. `CAP_SERVER_URL` alone does not change native trust or token routing. Therefore the current configuration is not a safe provider harness.

Before SDK simulation or physical test-mode use, obtain explicit authorization and provision together:

- a separate Forge deployment using Stripe test publishable, secret and webhook keys;
- a separate non-production database with company/customer/job, connected-account and Terminal-location fixtures;
- a matching native Debug trusted origin and fixed token endpoint, preserving exact HTTPS/cookie/redirect/account checks;
- a matching test-mode connected account and complete real US Terminal location.

Verify all four values in the signed test artifact before setting `FORGE_TERMINAL_SIMULATED=1` or presenting a card. Never use production customer/job fixtures for this gate.

## Apple, Stripe and signing gate

- [ ] Apple approves the development Tap to Pay entitlement for `app.forgecrm`.
- [ ] The development profile contains `com.apple.developer.proximity-reader.payment.acceptance = true` and the existing app group, keychain group and associated domains.
- [ ] The App target alone uses `App/App-TapToPay.entitlements` and `FORGE_TAP_TO_PAY_ENABLED`, preserving inherited flags. Widget/test targets do not receive the app entitlement.
- [ ] Apple separately approves distribution use; the regenerated distribution profile and final signed app both contain the restricted entitlement.
- [ ] Stripe account readiness, merchant eligibility and current Tap to Pay iOS/device requirements are rechecked against current Stripe documentation.
- [ ] The connected account used by the isolated test deployment has a single unambiguous, complete US Terminal location and token minting returns that same account.
- [ ] Merchant Terms of Service and Apple's required education are completed; How to Tap can be reopened.
- [ ] The ordinary unentitled build still reports a useful manual-entry fallback.

## Physical-device acceptance matrix

Use a supported iPhone with NFC, passcode, an Apple Account and a current released Stripe-supported iOS version. Record app version/build, iOS/device model, signing/profile identifiers, Forge environment, Stripe mode/account and Terminal location for every run.

- [ ] Physical contactless card payment succeeds with save unchecked; one provider intent and one canonical Forge payment are recorded.
- [ ] Wallet payment succeeds and displays only safe summary fields.
- [ ] Payment with explicit save consent records payment even if generated-card saving later fails; retry saves once without recollecting or changing the default.
- [ ] SetupIntent tap-to-save with a physical card and supported wallet creates no Payment row, charge or subscription activation.
- [ ] Declined, removed-card, timeout and reader-disconnect cases show actionable errors and do not record success.
- [ ] Customer cancel, merchant cancel, background, navigation away, logout, session expiry and connectivity loss reconcile the same attempt.
- [ ] Ambiguous confirmation remains blocked/recoverable across dismissal and relaunch; duplicate taps or another device cannot create a second unresolved job payment.
- [ ] Company switch and connected-account remapping fail closed; no attempt, token, reader callback or saved method crosses tenants/accounts.
- [ ] Saved Terminal card is absent from implicit job/subscription fallback. Explicit selection on an accepted and, when required, signed subscription forwards that card without changing customer defaults, charging immediately or prorating.
- [ ] Wallet-generated cards remain recurring/off-session-only and cannot be used by general saved-card or manual amount-override paths.
- [ ] An old or unsupported native app keeps manual card entry and never initializes a reader or requests permission merely from capability detection.

## Rollout gate

Archive/signing, TestFlight/App Store upload, production deployment, live-mode testing and merchant rollout require explicit authorization after the matrix above is documented. During rollout, monitor retryable webhook failures, unresolved attempts, payment-recorded/card-save warnings and account/location setup errors. A successful native callback is never proof of payment; the canonical server reconciliation result remains authoritative.

The iOS-specific entitlement and build instructions are in [tap-to-pay-ios-release.md](tap-to-pay-ios-release.md).
