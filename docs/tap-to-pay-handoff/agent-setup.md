# Agent setup: private, reproducible recording environment

Work on `feature/tap-to-pay-owner-handoff` or a fresh descendant. Preserve main's production flags/signing configuration. No user-specific build or secret is committed. Node **24.12+**, installed web/mobile dependencies, Xcode and the approved development profile are prerequisites.

## 1. Prepare offline first

From the repository root, after installing the repository's locked dependencies:

```sh
node apps/web/scripts/tap-review/review.mjs prepare
```

This creates a new private temporary directory and prints its path. Call it `RECORDING_DIR` below. It copies tracked web files (never dotenv files), symlinks the existing dependencies, initializes a fresh SQLite database and creates one fake merchant, admin/technician logins, a fake customer and three unpaid jobs. `fixtures.json` stores their IDs and random password (sensitive, mode 600). No Stripe request occurs. It does not import production data. It uses current tracked working files; ensure your checkout is the intended reviewed revision with no unrelated tracked edits before preparing.

Keep this repo/dependencies in place: the disposable workspace links to them. Prepare again after source changes; do not manually copy production dotenv files into it. Failed preparations are not resumable; inspect the printed workspace before removing that exact directory.

## 2. Arrange HTTPS without exposing the backend

Choose an owner-authorized non-production HTTPS origin, **not any forgecrm.app host**, terminating at **127.0.0.1:3131**. The backend on **127.0.0.1:3130** must never be exposed directly. Use an existing trusted tunnel/reverse proxy. For an installed Cloudflare tunnel CLI, a temporary session can be started with:

```sh
cloudflared tunnel --url http://127.0.0.1:3131
```

It initially reports the upstream unavailable; the gateway starts in step 4. Use the exact HTTPS origin it returns (no trailing slash). Keep the tunnel alive throughout onboarding and recording; if it changes, rebuild and resync the app. No tunnel is started by our preparation script.

The gateway requires a random private access cookie, pins the Host/Origin, rejects cross-origin writes and blocks cron, webhooks and OAuth. It allows **actual signup and Express Connect start/refresh/return**, unlike Andrew's old restricted proxy. It strips untrusted forwarding headers and enforces Secure cookies at the HTTPS boundary. Native connection-token requests intentionally send only `crm_session`; the gateway allows that one route with a valid, recent session signed by this disposable environment. The app still validates tenant/permissions/provider mode itself.

Private links and generated app configuration containing them are sensitive. Do not put them in recordings, commits, tickets or public review notes. Cookies expire after eight hours; open the private entry again and sign back in if necessary. Stop the server/tunnel when done; these are recording sessions, not durable reviewer access.

## 3. Stripe test credentials (Nick supplies/approves)

Without keys the tools run **offline**, with Tap to Pay disabled. For provider testing, put these into private **regular files** within RECORDING_DIR:

| File | Contents | Sensitive? |
| --- | --- | --- |
| `stripe-test-key` | Restricted `rk_test_…` key, never live | Yes; mode 600 |
| `stripe-test-publishable` | Matching `pk_test_…` from the same platform/sandbox | Public value, but file must still be mode 600 |

Key permissions must cover connected-account read/create and account links for Express onboarding; customer, PaymentIntent, SetupIntent and payment-method operations used by collection/saving; Terminal locations and connection tokens; charge/receipt/attempt reads for reconciliation. Use Stripe's current restricted-key labels; request only missing **test-mode** permissions after a specific denied operation. Do not broaden live keys. Prefix validation proves test mode, not matching platform, permissions or merchant ownership.

No webhook secret, Stripe OAuth client, production session secret, email/SMS credentials or real customer contacts are carried over. Production billing and announcements stay off. A user can still enter settings in this disposable application: never add real provider credentials or real contact details.

## 4. Build and run

Replace the two quoted placeholders with the printed absolute directory and chosen HTTPS origin:

```sh
node apps/web/scripts/tap-review/review.mjs build '/ABSOLUTE/RECORDING_DIR' 'https://YOUR-RECORDING-HOST'
node apps/web/scripts/tap-review/review.mjs serve '/ABSOLUTE/RECORDING_DIR' 'https://YOUR-RECORDING-HOST'
```

Build uses only the isolated directory and a fresh environment, not shell/repo secrets. Changing origin or keys requires rebuilding; the server rejects a mismatched build fingerprint. The server writes `entry-url.txt` privately. Open that URL in each browser context you will use, then log in using `fixtures.json`. Safari and the app webview do not share cookies: authorize/log in separately if onboarding opens external Safari. A return to login is not proof of onboarding failure; log into the same fake account and verify the actual Stripe status. `APP_URL` is pinned to the HTTPS origin to prevent the old localhost return problem.

## 5. Native development build on Nick's iPhone

1. Register Nick's supported iPhone on team **TG27DQJ464** and obtain a development profile for **app.forgecrm** with the proximity-reader acceptance entitlement plus existing app/keychain groups and associated domains. Nick controls Apple account access and approvals. Do not assume Andrew's registered profile covers this device.
2. In **App target only / Debug**, select `App/App-TapToPay.entitlements` and add `FORGE_TAP_TO_PAY_ENABLED` to Active Compilation Conditions, preserving inherited values and DEBUG. Do not alter widget/test entitlements. Keep these local recording changes out of a production PR.
3. In the **local recording checkout only**, add the exact recording hostname (no scheme/path, no wildcard) to `server.allowNavigation` in `apps/mobile/capacitor.config.ts`, preserving existing entries. This is required: Capacitor otherwise opens the entry-link redirect outside the app because the full private URL is not a prefix of `/login`. From `apps/mobile`, run `CAP_SERVER_URL="$(cat '/ABSOLUTE/RECORDING_DIR/entry-url.txt')" npm run sync -- ios`. Inspect the generated config for both the private URL and the exact allowed host. The private link grants recording access, so these local/generated changes must not be committed or distributed. Subsequent launch reopens login through the gate.
4. In Xcode Run scheme environment, set `FORGE_TERMINAL_TEST_ORIGIN=https://YOUR-RECORDING-HOST` (not sensitive) and `FORGE_TERMINAL_SIMULATED=1` (not sensitive) for simulation. The origin has no path; do not put the private entry link here. Use Debug; Release ignores these overrides. Build/install with Xcode and run **from Xcode** so the launch variables are actually present. Launching by tapping the icon after force quit may omit them; relaunch from Xcode.
5. Verify signed app/profile entitlements, the configured origin and Stripe test mode before pressing Prepare. Have Nick accept merchant terms and choose his Apple Account. Do not automatically accept legal agreements or unlink/reset another merchant's terms.
6. For real physical-reader test evidence, use a supported released iOS version and the method Apple/Stripe require; omit simulation only with explicit approval and the correct test card. Do not switch to live keys to obtain a recording.

## 6. Recording data and owner-dependent content

- Existing-merchant video: log into the seeded admin, complete **test** Express onboarding through Payments with Nick's approval, and select/create its actual complete US Terminal location. Do not fabricate charges_enabled, a location ID or terms acceptance in the database.
- New-user video: use real signup with a different fake company/email; it creates its own admin and isolated tenant. Have Nick complete the test onboarding flow. Use only approved test identity data; provider account creation and legal attestation remain user-controlled.
- Generate fresh unpaid jobs through the app when needed. Never reset a paid job or delete an unresolved attempt merely to film another success. Save-card flow uses explicit customer consent and does not create a subscription.
- The actual announcement remains unavailable until Nick supplies approved copy/assets. With those inputs, add a versioned `approvedTerminalAnnouncement` in `src/lib/terminal-announcement-content.ts`, including a real approval reference. Only then, in a separately reviewed **recording-only** configuration, permit `TAP_TO_PAY_ANNOUNCEMENT_ENABLED=true` (not sensitive). The runner currently forces it false; do not mark the awareness shot complete before this gated follow-up is implemented and tested. No Apple artwork is synthesized by this handoff.
- A merchant that accepted Apple's terms may not show them again. Ask Nick/Apple for an authorized fresh-merchant/reset approach; do not assume reinstall/logout resets acceptance.

## 7. Verify before asking Nick to record

Run `npm test` from apps/web and `sh apps/mobile/ios/App/ForgeWidgetTests/run-terminal-tests.sh` from repo root. Build the actual opted-in app, inspect its packaged PrivacyInfo.xcprivacy for SystemBootTime reason 35F9.1, and inspect signed entitlements. Check private-gate rejection, signup/login, same-account onboarding return, selected location, native token issuance, simulated payment/save, cancel/recovery, decline sharing and receipt visibility. Check one Stripe test intent and one canonical payment per successful attempt. No successful payment claim from a redirect or native callback alone.

## 8. Stop and restore

Stop the recording server and tunnel. Remove Run scheme test variables, the exact recording hostname added to allowNavigation, and local opt-in signing changes. From apps/mobile run `env -u CAP_SERVER_URL npm run sync -- ios`; verify the generated URL is `https://www.forgecrm.app/login` and no recording host remains in allowNavigation. Preserve videos/evidence privately; remove only the exact disposable workspace when it is no longer needed. Do not erase payment history to hide a failed take. Do not upload this private-link development build to TestFlight/App Store.
