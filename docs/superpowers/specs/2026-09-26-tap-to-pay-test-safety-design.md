# Tap to Pay test-environment safety

## Intent and scope
Enable real end-to-end development testing of job payments and tap-to-save without accidentally using live Stripe credentials. This follows the reviewed setup branch, not a production rollout. The user delegated spec self-review and implementation. No Stripe account changes, payments, Apple signing changes, or production enablement are authorized by this change.

## Approach
Use a DEBUG-only native HTTPS test-origin override and a server-validated provider-mode handshake. Merely setting the SDK simulated-reader flag is insufficient. A separate app target would duplicate configuration; a runtime override in Release would unnecessarily expand the production trust boundary. Keep Release fixed to the existing production origin and real readers.

### Native boundary
- `FORGE_TERMINAL_TEST_ORIGIN` selects one exact HTTPS origin in Debug. Reject credentials, non-443 ports, query/fragment, non-root paths, and forgecrm.app or any of its subdomains. Invalid values disable Terminal, never fall back to production.
- `FORGE_TERMINAL_SIMULATED=1` requires a valid test origin. Debug with a test origin always expects `test`, whether using a real or simulated reader. Ordinary Debug and Release expect `live` at https://www.forgecrm.app. Release ignores both variables.
- Capture immutable configuration for a native session. Trust, cookies, request Origin, token endpoint and response verification use that configuration. Preserve the account/session/terms checks and redirect refusal.
- Send `X-Forge-Terminal-Mode` in token requests; require token response `provider_mode` to match. Missing mode is tolerated only for live compatibility; never for test. Expose `providerMode` from native capabilities for web requests.

### Server boundary
- `TAP_TO_PAY_MODE` defaults to `live`; only exact `live` or `test` accepted. Terminal requires matching secret/restricted and publishable key modes. Reject an already-initialized Stripe singleton whose credential no longer matches the environment; do not silently change the shared client.
- Check before new intents, customer creation, location changes and tokens. Requests declaring `X-Forge-Terminal-Mode` must match the verified server mode before Terminal effects. Missing headers remain compatible with existing live clients; they do not bypass server configuration validation.
- Native web setup/checkout requests propagate their declared mode on Terminal endpoints. Preserve generation checks around asynchronous capability lookup so an old session cannot send a late mutation.
- A failed/malformed native capability lookup is not a legacy live client: reject before fetch and clear any creation-uncertainty marker for that never-sent request. Authenticated, provider-free attempt listing bypasses native/provider preflight so ordinary checkout remains usable when no unresolved attempt exists; this exception never permits a mutation or reconciliation.
- Token response includes verified `provider_mode`. Errors expose no credentials. Existing reconciliation/cancellation remains available with rollout off and correct credentials. Do not apply Terminal guards to ordinary subscription/manual-card routes sharing the HTTP helper.

### Limits and verification
This guard does not prove database isolation, merchant ownership, key validity or permissions. Real testing still needs a disposable database containing only fake companies/customers and a test Connect merchant. It is not permission to use live keys or accept merchant terms. Add regression tests for mismatch-before-effects, unsafe origins, Release overrides, cookie isolation, missing response mode, rollout-off recovery and session changes. Run full web tests/build, standalone native tests and unsigned simulator/Release builds. One independent review; merge requires explicit approval. Receipts and Apple's physical-device/distribution review remain separate required work.

Sources: [Stripe key modes](https://docs.stripe.com/keys), [Terminal testing](https://docs.stripe.com/terminal/references/testing).
