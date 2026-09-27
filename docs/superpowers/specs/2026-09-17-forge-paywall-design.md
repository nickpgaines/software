# Forge company subscription paywall — dormant implementation

## Authority and rollout

The user authorized implementation using provisional recommendations, and explicitly requires confirmation before anything is shown to customers. Do not merge, deploy, enable a flag, provision live Stripe objects, send notices, charge accounts, or change production data as part of this implementation. Existing untracked files belong to the user.

`FORGE_BILLING_ENABLED` defaults off; only exact `true` enables customer-visible billing and enforcement. Disabled means no new billing UI, provider calls, notices, or restrictions, even after trial expiry. No date-triggered rollout or automation. **September 21 amendment, approved by the user:** each company gets 14 days (336 hours) from signup, retroactively for existing companies and prospectively for new ones. September 26 is only a possible rollout date. `FORGE_BILLING_CUTOFF_AT` is obsolete and ignored.

Legacy companies have no creation timestamp. Permanently snapshot the earliest remaining staff `created_at` in an additive `forge_billing_trials` table, using the approved existing admin-dashboard estimate; a previously deleted founding employee may make this estimate late. A database trigger captures exact signup for future companies in the insertion transaction, even while disabled. Adding/deleting staff, schema reinstalls, and rollout toggles cannot reset trials. Missing, invalid, or future historical dates require operator recovery without manufacturing free access; existing verified paid entitlement remains valid. Treat legacy SQLite dates as UTC and display expiration with an explicit time zone.

## Product behavior

- One subscription per company, covering its employees. Founder prices in USD: Solo $79/month or $790/year (1 employee), Team $149/month or $1,490/year (8), Business $229/month or $2,290/year (30). Annual totals, not rounded monthly equivalents, are charged. No unapproved grandfathering, coupon, tax or automatic selection/upgrade.
- Existing staff with `settings.view_all` may manage company billing; ordinary employees see an account-status screen and contact-administrator instruction, no checkout. Existing platform-admin access remains available. No new owner role.
- During the company's 14-day trial, enabled rollout permits CRM access. At the exact expiration instant, unpaid companies cannot use the normal CRM. Authentication stays intact so users can reach account recovery, billing, export, support, logout and account deletion. Never use administrative `access_status=revoked` for unpaid accounts.
- Preserve data. Do not delete staff when over seat limit or silently upgrade the plan. Refuse checkout for a plan below current staff count; prevent additional staff above a subscribed plan's cap with a transaction-safe check.
- Existing public invoice/estimate/service-subscription links, provider webhooks and reconciliation of existing payment attempts continue working. Do not cancel or rewrite the service subscriptions a merchant has sold to homeowners; those are separate financial agreements.
- Initial gate is company subscription plus employee seats. Existing granular role permissions stay unchanged. Exact marketing feature-tier enforcement is a separate activation decision: owner must confirm whether to restrict existing users' back-office tools. Do not silently remove existing feature access by inferred route mappings.
- No new automatic email/SMS notices. Notice copy and notice timing require activation approval.

## Billing boundary and safety

Create separate `forge_billing_*` tables with additive idempotent schema setup. They never reuse connected-account homeowner customer/subscription/payment rows. Stripe platform Checkout and Billing Portal use a dedicated `FORGE_BILLING_STRIPE_SECRET_KEY` and separate `FORGE_BILLING_WEBHOOK_SECRET`; no fallback to existing live Connect keys. Six explicitly configured Price IDs must be retrieved and verified against price, USD, recurring interval and enabled state before Checkout. Fixed configured site origin for return URLs, no caller-supplied URLs. Configure portal for cancellation/payment-method management only until plan changes are explicitly supported.

Checkout must have a durable per-company reservation/idempotency key; concurrent/repeated requests reuse or reconcile the original Checkout session, never create another subscription on uncertainty or after Stripe's idempotency-cache expiry. Provider-canonical paid entitlement, not success URL/query strings, unlocks access. Existing live subscriptions block new Checkout. Portal ownership derives from the authenticated company. Price plan and provider mode/account identity remain bound to the local customer/subscription record. Native app requests never initiate Forge subscription Checkout or Portal.

Signed platform webhooks use raw body, reject Connect events/mode mismatches, retrieve canonical provider state, and apply updates idempotently without stale events reverting newer entitlement. Transient database/provider failures return retryable errors. Webhook reconciliation remains available when rollout is off for existing records, but never creates new customer purchases. A paid subscription canceled at period end retains access through its paid period; incomplete, unpaid, paused, unknown and expired states do not independently grant access. No grace period beyond the confirmed paid-through time for this first version.

## Access architecture

Use a Node access-check endpoint backed by current tenant/session and local billing state; Edge middleware calls it only when rollout is enabled. Never trust a client-supplied company ID or internal-bypass header. Middleware must strip/overwrite internal context headers and not recurse. Explicit safe paths avoid redirect loops. API denial is typed HTTP 402, page denial redirects to a standalone `/billing` screen outside the normal app shell. Lookup failure is a retryable 503, not a login loop or false unpaid verdict. Widget and MCP bearer surfaces require their own company entitlement checks without disrupting token revocation. APIs remain authoritative even if an old page stays open.

Offer a company-scoped data export for authorized administrators, limited to business records rather than credentials, provider secrets, consent tokens, or password/session material. Export and account deletion remain available while unpaid. Account deletion must also safely cancel an existing Forge subscription when deleting its company, with idempotent retry and no new charge, while preserving current last-employee semantics.

## UI and App Store constraints

Web billing shows exact plan prices/seat counts, recurring interval, explicit subscription consent via Checkout, current status, manage/cancel and refresh-payment-status actions. Disabled billing retains the current Settings placeholder and doesn't add nav/banner/marketing changes. Native displays only account status, contact administrator, export where authorized, support, deletion and logout; no prices, external purchase link or purchase CTA. App Review treatment of the Solo plan and final native copy remain a launch gate; this is not a claim of Apple approval. No native project/signing/build change is needed for the dormant web code.

When enabled, marketing/signup offers a 14-day company trial with no shared deadline. Keep current public copy unchanged while disabled. Use existing UI primitives/tokens. Preserve Tap to Pay's independent default-off gate.

## Acceptance

Tests cover dormant behavior after trial expiry, exact trial boundary, immutable historical snapshots, atomic future signup timestamps, migration compatibility, tenant isolation, ordinary staff vs billing admin, platform exemption, all invalid subscription states, cancel-at-period-end, checkout races/lost responses, price/mode validation, webhook duplicates/order/signatures, page/API/native restrictions, recovery exceptions, staff capacity races, export secret exclusion and company deletion billing cleanup. Use real SQLite and production logic; double only provider/HTTP/native boundaries. Run full web suite, TypeScript and isolated local production build, independent review. No real payments or production configuration changes.

## Owner confirmation before activation

Confirm rollout timing and historical signup estimates, prices and duration of founder pricing, cancellation/refunds/tax, staff counting and billing administrator permissions, feature-tier restrictions, over-cap companies, public service-link/automation continuity, native App Review path, notice timing, and paid test/physical acceptance evidence. Activation requires a separate explicit instruction after this checklist is approved.
