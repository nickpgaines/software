# Tap to Pay merchant and device setup

## Intent

Finish the existing job-payment and tap-to-save flows so a merchant can prepare their iPhone without creating a payment. Use existing Admin/custom-role permissions and the approved authorized-representative confirmation, not a new Owner role. Ordinary staff must not accept merchant agreements just by starting checkout. Keep production disabled and defer Apple/Nick account actions until independent app work is ready.

This is a follow-on to the September 16 integration, not company subscription billing. PR #372 supplies the prerequisite employee/role authorization boundary. The user delegated spec self-review and implementation; execute locally on a fresh branch, with a separate merge gate for payment/auth changes.

## Merchant location and authorization

- `settings.view_all` authorizes merchant setup; resolve current effective permissions server-side using the strict resolver. A missing staff record, invalid role or foreign custom role fails closed. Platform administration retains existing access.
- Location GET is authenticated, private/no-store and read-only. It lists valid US Terminal locations belonging to the currently connected Stripe account, identifies a valid cached selection or the sole valid candidate, and reports whether the current user can manage setup. No placeholder location or payment is created.
- Location POST is same-origin, rollout-gated and requires setup permission. It either selects an existing account-scoped valid location or creates one from an explicit merchant-confirmed display name and structured US address. Reject missing/placeholder address fields, invalid state/ZIP, foreign/deleted location and ambiguous request shape. Use stable Stripe idempotency for duplicate creation submissions. Recheck company/account before persisting a selection.
- Preserve explicit selection among multiple locations. Checkout retrieves the chosen location in the current connected account, or chooses the sole valid candidate; never trusts an unvalidated cached ID. The legacy intent path must use this same resolver and must no longer create placeholder locations.

## Native preparation and terms

- Add a separate `prepareDevice` operation (not SetupIntent creation). It shares the existing native exclusive-operation, cookie/session validation, cancellation, cleanup and account-switch protections.
- Preparation distinguishes ordinary device configuration from merchant activation. Only explicit representative confirmation plus a fresh server permission decision may permit Apple terms. Use a native-authenticated setup token request, not a JavaScript boolean as authority; check authorization on every token refresh.
- Ordinary payment/tap-to-save and nonrepresentative preparation explicitly set SDK `tosAcceptancePermitted=false`. If merchant terms are required, explain that an authorized administrator must complete setup. Never accept terms automatically.
- Preparation connects, presents education and completes without retrieving, collecting or confirming an intent. Cleanup must not allow a stale operation to unlock a newer one.
- Scope preparation/progress/error events to the active operation. Ignore stale events after cancel/logout/account change. Education presents from the topmost visible controller.

## UI

- Reuse the design system's existing Settings cards, fields, status text and buttons; no new visual primitive. Put Tap to Pay setup and How to Tap in Payments settings. On non-iPhone/old builds, explain the compatible-app requirement without hiding ordinary card payments.
- Show setup availability, connected-account readiness, location selection/address fields for authorized staff, explicit representative confirmation, preparation progress and a clear ready/error result. Do not claim merchant/device readiness from a cached browser flag.
- Checkout routes setup-required errors to this flow. Use text-only Tap to Pay branding until approved SF-symbol artwork is available. Keep independent payment-recorded/card-saved outcomes and server reconciliation authoritative.

## Verification and remaining program scope

Use real route/helper SQL with external Stripe boundaries stubbed; test authorization, same-origin, disabled rollout, provider outage, account changes, invalid/foreign/deleted locations, ambiguous lists, duplicate submissions and no writes during GET. Native lifecycle tests cover preparation with no intent, terms denial, cancellation, stale callbacks and session changes. Verify web UI at desktop/mobile sizes and on simulator, plus unsigned Simulator and opt-in device builds.

This slice does not close the overall readiness objective. After it: isolated native test-origin/provider-mode safeguards; compliant approved/declined receipt offers; actual Apple checklist comparison; signed registered-device acceptance for job payment and tap-to-save; recordings and distribution approval. Do not enable production, charge a real card, accept Apple terms, upload or contact Apple/Nick on the user's behalf.
