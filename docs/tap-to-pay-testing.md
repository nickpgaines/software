# Isolated Tap to Pay testing

These instructions configure development testing. They do not enable production, authorize real charges, accept Apple's merchant terms, or replace Apple's physical-device review.

## Environment requirements

1. Run the feature branch against a **new disposable database with fake accounts only**. Do not point test Stripe keys at the production database, copy customer data into it, or reuse production auth/session secrets. Disable outbound SMS/email and unrelated automations.
2. Use a separate Stripe sandbox/test Connect merchant with test onboarding complete, a valid US Terminal location, and a fake company/staff/customer/job. Stripe key mode checks cannot prove the database is disposable or that the keys belong to the intended platform.
3. Configure that server only:
   - `TAP_TO_PAY_ENABLED=true` — **not sensitive**, isolated server only.
   - `TAP_TO_PAY_MODE=test` — **not sensitive**. Missing defaults to `live`; invalid values fail closed.
   - `STRIPE_SECRET_KEY` — **sensitive**, sandbox `rk_test_…` or `sk_test_…`. Restricted keys need the specific Connect/Terminal/payment resources exercised by the test. Do not broaden live permissions.
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — **not sensitive**, matching `pk_test_…`.
   - Test webhook signing secret — **sensitive**, if exercising delivery/reconciliation webhooks; never reuse a live endpoint secret.
4. Expose only the disposable server through an approved HTTPS endpoint. Keep it authenticated. Do not publish a production database or local secrets through the tunnel.

## Native Debug build

1. From `apps/mobile`, set `CAP_SERVER_URL` to the isolated HTTPS URL plus `/login`, then run `npm run sync -- ios`. This variable is **not sensitive**. It changes the generated local Capacitor configuration, not Terminal's native trust policy.
2. In Xcode's **Run → Arguments → Environment Variables**, set:
   - `FORGE_TERMINAL_TEST_ORIGIN=https://your-isolated-host` — **not sensitive**, origin only (no `/login`, query, fragment or credentials). HTTPS/443 only; no `forgecrm.app` host or subdomain.
   - `FORGE_TERMINAL_SIMULATED=1` — **not sensitive**, for simulated-reader testing. Requires the valid test origin above. Omit for physical-reader testing against test Stripe.
3. Use Debug. The app's origin and test origin must match exactly. Invalid overrides fail closed; they never fall back to production. Release ignores both variables, expects the production origin and live Stripe, and never simulates a reader.
4. A real device still needs the Tap to Pay build flag, registered-device provisioning and Apple's development entitlement. A simulator cannot prove NFC, merchant terms, or App Store distribution approval.

## What to verify

- Authorized administrator can select/create the real test merchant's US location and explicitly opt into merchant terms; ordinary staff cannot grant themselves that authority.
- Prepare device does not create an intent or collect money. Cancel/retry and account switching do not reuse old authorization.
- Job payment succeeds once and records once; decline/cancel/lost response keeps the original attempt recoverable without a second charge.
- Tap-to-save and payment-with-save require explicit customer consent and save only a reusable generated card; wallet/no-generated-card outcomes remain distinct from payment failure.
- App test mode against a live/misconfigured server fails **before** an intent/location/token is created. Never prove this with real live credentials; use automated boundary tests.
- Turning off rollout does not prevent reconciling/canceling existing attempts with matching credentials.
- Missing native/Stripe configuration does not block manual checkout when the authenticated attempt list is empty. Unresolved attempts still block another charge until reconciled. A failed native environment check never silently switches a mutation to live mode.

## Restore after testing

Stop the isolated server/tunnel. Remove the Xcode Run test variables. From `apps/mobile`, run `env -u CAP_SERVER_URL npm run sync -- ios` and verify the generated URL is `https://www.forgecrm.app/login` before building a production app. Do not merge, distribute or enable Tap to Pay until review and approval gates are satisfied.

The on-screen fixture at localhost:3118 is static visual verification only; it is not this end-to-end environment.
