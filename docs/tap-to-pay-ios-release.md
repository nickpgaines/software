# Forge Tap to Pay on iPhone release gate

The native `ForgeTerminal` plugin uses the official Stripe Terminal iOS SPM package pinned exactly to **5.8.0**. App deployment remains iOS 15; Tap to Pay and Apple's built-in How to Tap education require **iOS 18 or later** in Forge. This minimum is not a promise Stripe supports every older OS: use a current released iOS version that Stripe supports. Beta iOS is not supported by Stripe for physical Tap to Pay.

## Signing is opt-in

The standard Debug and Release configurations retain `App/App.entitlements`. They do **not** request the restricted Tap to Pay entitlement. `getCapabilities()` returns an actionable unavailable reason in these builds. Version 1.1 and build 8 are unchanged.

Before enabling physical acceptance:

1. Request Apple's Tap to Pay on iPhone development entitlement for the existing `app.forgecrm` identifier. This is a separate, explicitly authorized signing-account action; nothing in this implementation submits a request or edits Apple accounts.
2. Obtain the corresponding development provisioning profile and confirm it contains `com.apple.developer.proximity-reader.payment.acceptance = true` plus Forge's existing app-group, keychain-group, and associated-domain entitlements.
3. In the **App target only**, select `App/App-TapToPay.entitlements` as Code Signing Entitlements and add `FORGE_TAP_TO_PAY_ENABLED` to Active Compilation Conditions, preserving `$(inherited)` and `DEBUG` where present. Do not apply the app entitlement file to the widget extension or tests. Both the entitlement and compile condition are required; merely flipping the compile condition does not grant OS permission.
4. For TestFlight/App Store distribution, request Apple's distribution entitlement approval, complete Apple's merchant onboarding/education review, and regenerate the distribution provisioning profile. Verify the signed app and embedded profile contain the restricted entitlement before testing a distribution build.
5. Keep the opt-in settings in a dedicated local/release configuration until approval and physical verification are complete. Do not change the standard checked-in signing configuration as an incidental build fix.

Sources: [Apple setup](https://developer.apple.com/documentation/proximityreader/setting-up-the-entitlement-for-tap-to-pay-on-iphone), [Stripe Tap to Pay setup](https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=ios), [Apple merchant education](https://developer.apple.com/documentation/proximityreader/proximityreaderdiscovery).

## Merchant and server readiness

Use Forge's authenticated connected-account direct-charge flow. The company must have a ready Stripe account and a real, complete US Terminal location on that same account. Resolve missing/ambiguous address or location configuration before creating an attempt. Native requests only `https://www.forgecrm.app/api/stripe/terminal/connection-token`, with the current secure `crm_session`, fixed Origin and the attempt's matching `X-Forge-Stripe-Account`. No JavaScript URL, arbitrary origin, cookie, token, or simulation flag is accepted.

The web layer creates and reconciles attempts and records consent. Native's `{ intentId }` is a signal to reconcile, never proof a job was paid. `payment_unknown` requires recovery of the same attempt; do not start another charge. A cleanup failure deliberately prevents a new reader operation until reset succeeds or Forge restarts. Cancellation/backgrounding while confirming is treated as unknown even if cancellation is acknowledged.

Saved cards use limited redisplay in the SDK, remain explicit-selection-only, and do not create a subscription or billing default. Payment success and card-saving success must remain separate in the UI.

## Local verification

Run the same lifecycle and HTTP-boundary XCTest cases directly on macOS without a simulator or provider account:

```sh
sh apps/mobile/ios/App/ForgeWidgetTests/run-terminal-tests.sh
```

Build without signing or a booted simulator:

```sh
xcodebuild -project apps/mobile/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/forge-terminal-baseline-build CODE_SIGNING_ALLOWED=NO build-for-testing
```

After the user boots a simulator, run the App scheme's ForgeWidgetTests on that device. The behavioral tests inject the SDK and HTTP boundary and do not make provider requests. They exercise operation serialization, cleanup, confirmation uncertainty, stale callbacks, origin/cookie restrictions, redirects and account/session changes. A separate Release build verifies the production compilation path.

For an explicitly authorized **test-account-only** SDK harness, set `FORGE_TERMINAL_SIMULATED=1` in the Debug Xcode launch environment. It enables the SDK's simulated Tap to Pay reader; it is not a JavaScript option and is compiled out of Release. It still uses real authenticated test-mode server attempts and real Stripe test tokens. Never point that harness at a live-mode company. Forge does not enable simulation by default and automated behavioral tests do not use this harness. Apple's education UI is still required in the interactive harness.

## Physical iPhone acceptance checklist

- Use a supported iPhone with NFC, passcode, an Apple Account and a current **released, Stripe-supported** iOS version. Verify hardware/OS eligibility against Stripe's current requirements.
- Verify development and distribution entitlements independently; also verify that the standard unapproved build gives the manual-entry fallback.
- Test location permission first-use, denial, subsequent Settings approval, connectivity loss and reader preparation/update UI. Capability checks on launch must not prompt for permission or mint tokens.
- Complete merchant Terms of Service during reader connection. Confirm Apple's merchant education appears before collection and How to Tap can be reopened from the web action.
- In Stripe test mode, test job payment with save unchecked, payment with recorded save consent, and SetupIntent-only tap-to-save. Verify canonical server records, generated-card restrictions, no default changes and no subscription activation.
- Test customer cancellation, merchant cancellation, backgrounding, logout, navigation away, session expiry, connected-account change, duplicate taps and a delayed provider callback. Recover the same attempt after an uncertain confirmation; never create a second charge automatically.
- Confirm the app can recover after reader disconnect and that a failed cleanup prevents another operation. Check all SDK/backend errors remain safe and actionable without exposing tokens or client secrets.
- Obtain separate authorization before any live payment, account/provisioning mutation, upload or rollout. This implementation has not performed those actions.

Simulator builds and mocked provider tests do **not** verify NFC card acceptance, merchant provisioning, Apple education presentation, physical permission flows, or live settlement. Those remain release gates.
