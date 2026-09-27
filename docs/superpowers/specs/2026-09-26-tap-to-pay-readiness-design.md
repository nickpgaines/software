# Tap to Pay reader readiness and terms status

## Goal

Prepare an eligible, already-enabled merchant's reader on authenticated launch and foreground return so checkout can reuse it safely. Determine terms acceptance from Stripe's Apple account-link lookup, not a persisted readiness boolean. This slice follows the [shared constraints](2026-09-26-tap-to-pay-review-gaps-design.md).

## Scope and structure

Extend the existing native coordinator/session/reader and JavaScript bridge. Mount one small lifecycle controller in the authenticated app shell; Settings and checkout consume its current status rather than independently warming the same reader. The coordinator owns reader exclusivity. JavaScript cannot authorize Apple terms or choose a foreign account/location.

The native lifecycle separates disconnected, warming, ready, collecting and cleaning states. A reader ready state is ephemeral and bound to the exact current session, Stripe account, location and provider environment. No reader-ready or terms-accepted flag is persisted as authority.

## Entry and exit rules

- Before warm-up, obtain fresh authenticated server availability, current company/account, charging eligibility and validated location. Skip unsupported devices, old bridges, signed-out users, disabled rollout, incomplete onboarding and missing locations.
- Check account linking through the Stripe SDK under the pinned native session. Distinguish accepted, needs authorized setup and unavailable/unknown. Unknown is not accepted.
- Automatic warm-up never displays terms, education, permission prompts or payment UI. It creates no PaymentIntent/SetupIntent, collects no card and charges nothing. If setup or OS permissions require interaction, expose an explicit Settings action instead of prompting during launch.
- Merchant terms remain restricted to explicit authorized preparation with fresh server permission and representative confirmation. Account-status lookup does not grant permission to accept terms.
- Debounce duplicate launch/focus events and allow only one warm-up. Do not run timers in the background or compete with collection, education or cleanup.
- On background, logout, untrusted navigation, cookie/session change, company/account/location change, unsupported mode or rollout withdrawal, invalidate readiness and drain outstanding SDK work before clearing credentials. Late callbacks cannot restore stale readiness.

## Checkout handoff

Before collection, revalidate the current authorization and identity. Reuse the idle reader only when its entire binding matches the attempt. Transition ownership atomically; no idle warm-up callback can cancel or take over a payment.

If warm-up is still running, show the existing initializing/progress state and hand off after successful completion. If unavailable, preserve manual fallback and explicit setup guidance. Never create a replacement attempt to recover from a readiness error.

After an operation, clear intent/card references regardless of outcome. Retain an idle reader only after successful cleanup of operation state and fresh validation of the same foreground session. Ambiguous confirmation and failed cleanup follow the existing locked recovery path; do not optimize these by clearing locks.

## User experience

Settings shows checking, setup required, preparing, ready and unavailable states based on current provider/native facts. Education remains after explicit initial preparation and available through How to Tap, not before every payment. Checkout shows initialization before opening the reader and processing until server reconciliation completes.

Apple's one-second target is an acceptance measurement, not a promise inferred from cached state. Add safe timing instrumentation with no identifiers, secrets or card data so physical repeated runs can measure button-to-reader presentation. Do not weaken validation to manufacture a passing timing result.

## Verification

Native tests cover matching idle reuse, terms forbidden during automatic warm-up/collection, provider-link unknown/false, one active operation, foreground duplication, logout/account switching, stale events, canceled warm-up, cleanup failure, background during confirmation and intent data cleared before idle reuse. Web tests cover disabled rollout, old app, absent setup, stale responses, session changes, no provider actions in browsers and no surprise prompts.

Actual-SDK compile and development-device testing are required. Demonstrate cold and warm initialization, cancellation/recovery and manual fallback in the isolated test environment. Real NFC timing remains unproven until supported physical test hardware is available.
