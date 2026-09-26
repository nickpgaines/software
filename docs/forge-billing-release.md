# Forge company billing release runbook

## Dormant by design

This implementation does not activate itself. `FORGE_BILLING_ENABLED` must be
the exact string `true`; a missing value, `false`, or any other value preserves
the existing CRM, Settings billing placeholder, public copy, and access rules.
Trial expiration is never an activation trigger. Do not enable billing, merge or
deploy an enabling configuration, provision live Stripe objects, notify
customers, or change production data without a separate owner approval.

The trial policy was confirmed September 21, 2026; commercial activation still
requires approval:

- Every company receives one 14-day (336-hour) trial from signup. Existing
  companies count retroactively from signup; companies older than 14 days
  require a paid subscription once rollout is enabled. September 26 may be a
  rollout target, but is no longer a shared trial deadline or scheduled action.
- Legacy company rows have no creation timestamp. Freeze their earliest
  remaining employee's `created_at` once in `forge_billing_trials`, matching
  the admin dashboard's existing signup estimate. This approved estimate may
  be later than original signup if the original employee was already deleted.
- A transactional database trigger records exact creation time for future
  companies, including while billing is disabled. Staff changes, reinstalls,
  or rollout toggles cannot reset the snapshot. Unknown/invalid/future legacy
  dates require operator verification (503 for unpaid access), not a fresh
  trial; verified paid access remains available.
- Founder prices are Solo $79/month or $790/year for 1 employee, Team
  $149/month or $1,490/year for 8 employees, and Business $229/month or
  $2,290/year for 30 employees. Annual Checkout charges the displayed annual
  total, not a rounded monthly equivalent.
- Existing staff with effective `settings.view_all` may purchase, manage,
  export, and recover company billing. Other employees receive status and
  contact-administrator guidance. No new owner role is introduced.
- Subscription entitlement and employee seats are implemented. Marketing
  feature tiers are not enforced. Any feature-by-plan mapping needs a separate
  product decision and implementation before it is advertised.
- Founder-price duration, taxes, refunds, proration, cancellation policy,
  over-cap treatment, notices, and staff-counting policy still require owner
  confirmation.

Choosing Checkout during the trial starts paid billing immediately. There is
no additional Stripe trial and no automatically deferred first charge.

## Configuration inventory

Use a dedicated Stripe platform billing setup. Never fall back to the existing
Stripe Connect credentials used for homeowner payments.

| Variable | Sensitivity | Requirement |
| --- | --- | --- |
| `FORGE_BILLING_ENABLED` | Non-secret rollout control | Exact `true` only after all gates pass. Keep false/missing while dormant. |
| `FORGE_BILLING_TAX_ENABLED` | Non-secret rollout control | Independent exact `true` opt-in for automatic tax on NEW company Checkouts. Keep false/missing until tax readiness, test-mode acceptance, and owner activation approval. Does not enable billing or change existing subscriptions. |
| `FORGE_BILLING_NATIVE_WEBSITE_ENABLED` | Non-secret rollout control | Separate default-off native website handoff. Do not enable until App Store storefront availability and the applicable external-purchase rules are verified. This flag does not detect storefronts. |
| `FORGE_BILLING_STRIPE_SECRET_KEY` | Secret | Dedicated restricted `rk_test_…` or `rk_live_…` recommended; standard `sk_…` keys also supported. Mode must match. |
| `FORGE_BILLING_STRIPE_ACCOUNT_ID` | Sensitive identifier | Stripe platform account owned by the dedicated key. |
| `FORGE_BILLING_STRIPE_MODE` | Non-secret | Exactly `test` or `live`. |
| `FORGE_BILLING_WEBHOOK_SECRET` | Secret | Signing secret for the dedicated endpoint and mode. |
| `FORGE_BILLING_SITE_ORIGIN` | Non-secret security boundary | Fixed trusted HTTPS origin, no trailing slash. Never derive from caller Host. |
| `FORGE_BILLING_PORTAL_CONFIGURATION_ID` | Sensitive identifier | Active configuration in the same mode/account. |
| `FORGE_BILLING_PRICE_SOLO_MONTH` | Sensitive identifier | Active USD licensed recurring Price for $79 every month. |
| `FORGE_BILLING_PRICE_SOLO_YEAR` | Sensitive identifier | Active USD licensed recurring Price for $790 every year. |
| `FORGE_BILLING_PRICE_TEAM_MONTH` | Sensitive identifier | Active USD licensed recurring Price for $149 every month. |
| `FORGE_BILLING_PRICE_TEAM_YEAR` | Sensitive identifier | Active USD licensed recurring Price for $1,490 every year. |
| `FORGE_BILLING_PRICE_BUSINESS_MONTH` | Sensitive identifier | Active USD licensed recurring Price for $229 every month. |
| `FORGE_BILLING_PRICE_BUSINESS_YEAR` | Sensitive identifier | Active USD licensed recurring Price for $2,290 every year. |

Price IDs must be six distinct objects. The application retrieves and verifies
every Price's amount, USD currency, enabled state, licensed recurring usage,
interval, mode, and platform account before creating Checkout.

## Tax preparation and activation

Scope is Forge's own company subscriptions only. Do not change connected
merchants' homeowner payments, Terminal, service subscriptions, or tax settings.
Deploying this code does not register the business, enable Stripe Tax, enable
the paywall, or consent to a paid Stripe Tax plan.

### Confirm with the owner / tax adviser

- Confirm the legal entity, actual head office, other business-presence states,
  existing registrations, relevant sales history (including off-Stripe sales),
  and the jurisdictions/type of tax that apply. Stripe's monitoring is not a
  legal determination and does not cover the home jurisdiction.
- Verify an existing SC Retail License before applying for a duplicate. Enter
  EIN/SSN/ownership and banking details directly in the official application,
  not in code, commits, chat, or logs. Application submitted is not approval.
- Record approved registrations and their effective dates. Adding a Stripe
  registration object does NOT register the business with a tax authority.
- Approve the exact product tax code for this hosted CRM subscription; do not
  silently use the account-wide generic "Electronically Supplied Services"
  fallback or alter shared account defaults that could affect other products.
- Confirm whether founder prices include tax or tax is additional. Set each
  Forge Product's explicit tax code and each of the six Prices' explicit
  `tax_behavior` after approval. Stripe may require replacement Prices if an
  already-fixed behavior must change; do not replace IDs blindly.
- Confirm Stripe Tax fees/plan and who files returns and remits taxes. Automatic
  calculation/collection alone does not complete filing/remittance setup.

Prepared customer copy (not yet published; use existing pricing typography):
- Exclusive: "Plus applicable tax. Final total shown at checkout."
- Inclusive: "Applicable tax included. Final total shown at checkout."
Apply approved wording consistently to web plan selection and marketing
pricing before activation. Do not add purchase/pricing content to native views
while the separate native rollout remains disabled.

### Read-only readiness command

From `apps/web`, with Node 24+ and the dedicated billing environment loaded
securely, run:

```sh
node --no-warnings --experimental-strip-types scripts/forge-billing-tax-check.mjs \
  --head-office-state SC --tax-code APPROVED_STRIPE_TAX_CODE \
  --tax-behavior exclusive --states APPROVED_COMMA_SEPARATED_STATES
```

The state/code placeholders must come from the approved registration scope.
`exclusive` above is an example, not an approved pricing decision. No secrets
belong in command arguments. Credentials are sensitive; the three rollout
flags and jurisdiction/code/behavior options are non-secret configuration.
The key needs read access to its account, Products, Prices, Tax Settings, and
Tax Registrations. Obtain approval before expanding access. This script makes
only read calls; it uses no application DB or customer data. It fails closed
on missing permissions, incorrect account/mode, incomplete Tax settings,
not-yet-effective registrations, unexpected active jurisdictions, incorrect
prices, or missing explicit product classifications/price tax behavior.

The check currently covers US state sales-tax registrations only. Additional
local or international registrations require a reviewed extension; do not
remove valid registrations just to make this check pass. It verifies supplied
configuration, not whether the supplied list satisfies all legal obligations.
Head-office matching checks country/state only; manually confirm the full
street/postal address. Effective-date checks establish that Stripe's entries
are active now; manually match those dates against actual registration approval
documents. Neither check verifies a tax-authority license.
`launchAuthorized` is always false: a passing result is never owner approval.

### Test-mode acceptance before live activation

Use fake accounts and separate test-mode tax settings/registrations. Never
create live registrations to make tests pass. For all six plans:

1. Complete a tax-enabled Checkout with a valid test billing address; verify
   the expected subtotal, tax breakdown, total and currency in Stripe.
2. Verify the address was saved on the Customer and the created subscription
   has automatic tax enabled. Test missing/invalid address and an appropriate
   zero-tax case, inspecting the reason rather than assuming exemption.
3. Verify canonical paid-invoice reconciliation, duplicate/retried webhook
   delivery, a taxed renewal, and a failed renewal followed by recovery.
   Failed/draft invoices must not extend paid access. Preserve correct plan,
   interval, seats, and paid-through date despite a tax-inclusive grand total.
4. Verify customer address changes and an unavailable tax calculation do not
   produce unintended untaxed collection or access from a success redirect.
5. Recheck default-off behavior and isolation from homeowner/Connect flows.

The regression fixtures use synthetic tax amounts to test reconciliation,
not to assert a particular address's legally applicable tax rate. Unit tests
are not evidence of real Stripe Tax calculation or successful registration.

### Controlled activation / rollback

- Keep `FORGE_BILLING_ENABLED`, `FORGE_BILLING_TAX_ENABLED`, and the native
  website flag off until the respective approvals and acceptance checks pass.
- Before flipping tax, inventory open Checkouts. Expire incompatible sessions
  in Stripe after confirming ownership and outcome; let the app's existing
  expired-session recovery retire reservations. Do not delete DB reservations
  to work around unknown outcomes. The app refuses to return an open session
  whose automatic-tax setting differs from the current flag, including after
  a lost response. Previously shared Stripe URLs must also be expired; the
  application guard alone cannot invalidate a URL a customer already holds.
- Enabling the flag affects new Checkout Sessions and their subscriptions,
  not already-created subscriptions. If any exist, inventory their addresses,
  tax settings, and next invoices and migrate separately with approval.
- Verify dedicated webhook URL, signing secret, subscribed invoice events,
  enabled state and successful delivery before enabling customer purchases.
- Once registrations are effective, apply approved catalog/copy, rerun the
  read-only check, confirm filing responsibilities, and obtain explicit live
  activation approval. Tax readiness does not replace other launch gates.
- Rollback is not merely flipping the tax flag off: existing subscriptions
  keep their tax configuration. To stop NEW sales, disable company billing;
  inventory open sessions and existing renewals before any provider changes.
  Never disable legally required collection merely to resolve a technical error.

References: [Stripe Checkout tax](https://docs.stripe.com/tax/checkout/page),
[Stripe Tax setup](https://docs.stripe.com/tax/set-up),
[Stripe Tax testing](https://docs.stripe.com/tax/testing).

### Optional native website handoff

When both billing and `FORGE_BILLING_NATIVE_WEBSITE_ENABLED` are exactly `true`,
authenticated native billing administrators may tap **Choose your plan**
(or **Manage subscription** for an existing subscription). The next-step card
appears before the account-status details and explains how to continue.
The app opens the configured HTTPS `FORGE_BILLING_SITE_ORIGIN` plus `/billing`
in the external browser. It never redirects automatically or includes session
tokens, credentials, or tenant identifiers in the URL. Browser sign-in may be
required. Native Checkout and Portal API requests remain blocked; the browser
performs its own authentication and administrator checks.

Missing, false, or malformed configuration hides the link without breaking
account status or recovery. Ordinary employees do not see it. Keep the flag off
while storefront availability is unknown. It is not a regional compliance
mechanism: distribution outside an approved scope needs storefront-specific
handling or another approved purchase flow before enabling this globally.

The default-off native acceptance criteria below remain applicable. If this
handoff is separately approved, also verify external browser opening, fresh
browser sign-in, and return-to-app payment-status refresh on a physical device,
and describe the flow in App Review notes.

`FORGE_BILLING_CUTOFF_AT` is obsolete and ignored. There is no global trial
deadline. Status exposes `trialEndsAt` and reason `trial`; public configuration
advertises `trialDays: 14` for new companies. The billing screen displays the
company-specific expiration time with an explicit Central time-zone label.

Before enablement, inspect `forge_billing_trials` and verify historical
estimates, especially companies whose founding employee has left. Do not
backfill unknown dates with deployment time or recompute snapshots from staff.
The migration is additive and transactional; it does not rebuild company or
staff tables. New signup and its trial timestamp commit or roll back together.

## Dedicated Stripe test setup

1. Create or select the dedicated Forge platform Stripe account in test mode.
   Record its account ID and a restricted test secret suitable for Checkout,
   Customers, Subscriptions, Invoices, Prices, and Billing Portal operations,
   plus account read access for the platform-account identity check.
2. Create the six exact Prices above. Put their IDs only in the Forge billing
   variables; do not reuse connected-account or homeowner-subscription Prices.
3. Create a Billing Portal configuration in test mode. Enable subscription
   cancellation and payment-method updates. Disable subscription updates and
   plan switching. The application rejects a configuration that differs.
4. Add the HTTPS webhook endpoint
   `https://<trusted-origin>/api/forge-billing/webhook`. Subscribe it to:
   `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.voided`, and
   `invoice.marked_uncollectible`.
5. Store the endpoint signing secret separately from the Stripe API key. Do not
   configure a Connect destination/context for this endpoint.
6. Configure a trusted HTTPS test origin and all variables in an isolated test
   deployment. Keep production `FORGE_BILLING_ENABLED` false or absent.
7. Exercise all six Checkouts, webhook delivery/retry, paid-invoice access,
   cancellation-at-period-end, payment failure, Portal cancellation/payment
   method updates, export, account deletion, and seat limits with disposable
   test companies. Confirm no homeowner payment or service-subscription record
   changes.

Checkout success URLs never grant access. After returning, use **Refresh
payment status** and confirm the canonical paid invoice produced entitlement.

## Uncertain provider outcomes and recovery

Creation and reconciliation fail closed. Never delete or rotate a Checkout
reservation merely to unblock a company.

- If Stripe creates a Customer or Checkout Session but the response is lost,
  locate the object manually using the recorded company/customer/reservation
  metadata and idempotency key. Confirm account, mode, company, Price, quantity,
  session, subscription, and invoice bindings before changing local state.
- If an unknown Checkout later becomes visible, let normal refresh/webhook
  reconciliation recover it. Do not replay creation after Stripe's idempotency
  cache might have expired.
- If account deletion set the durable `deleting` guard and provider
  cancellation is uncertain, keep the company and guard. Reconcile every Forge
  subscription first; only an operator should deliberately recover an aborted
  deletion after canonical cancellation is proven.
- Escalate multiple subscriptions, operator-edited Prices, inaccessible
  invoices, account/mode mismatches, or pagination uncertainty. Do not guess an
  entitlement or tell a customer payment succeeded from a redirect alone.

## Background-cost policy gate

Locking the CRM does not automatically stop every existing background/public
workflow. Before activation, the owner must explicitly approve which
provider-cost automations continue for unpaid companies. Decide at minimum:

- whether queued job-lifecycle SMS continues;
- whether lead-workflow email/SMS continues;
- how already-sold homeowner subscription billing and scheduled visits
  continue (the current design preserves them);
- continued public invoice, estimate, and homeowner service-subscription
  payment/acceptance links; and
- webhook, Terminal recovery, and existing payment-confirmation traffic.

Do not add billing notices through these channels without separate copy and
timing approval.

## Web and native activation gates

Before any customer-visible enablement, the owner must sign off on:

- browser acceptance for administrators, ordinary employees, active trial,
  unpaid, paid, past-due, scheduled cancellation, expired entitlement,
  provider outage, stale session, export, logout, support, and both account
  deletion scopes;
- real Stripe test-mode evidence for all six Prices, Portal, webhook retries,
  lost-response recovery, and canonical invoice entitlement;
- the rollout date, legacy signup estimates, prices and founder duration, permissions, feature-tier
  policy, cancellation/refund/tax policy, over-cap handling, automation policy,
  and notice plan;
- physical-device native acceptance showing account status, export where
  authorized, support, deletion, and logout with no price, Checkout, Portal,
  or website-purchase call to action;
- an App Review decision for company billing, including the Solo plan. The
  current implementation is a conservative preactivation posture, not a claim
  of Apple approval; and
- widget behavior. A billing 402 currently follows the widget's ordinary
  cached-snapshot/unavailable fallback, so an old cached snapshot can remain.
  Decide the desired payment-status messaging and retention behavior before
  activation.

Only after those gates pass: stage the exact production identifiers and
secrets, verify them without enabling, obtain a new explicit activation
instruction, enable in a controlled release, and monitor status/refresh,
webhook retries, duplicate-subscription guards, provider costs, and support
volume. There is no scheduled or automatic activation step.

## Implementation verification — September 17, 2026

Application code through `0d63f84` was independently reviewed task by task and
as a whole branch. All blocking findings were fixed and received scoped
re-review with no remaining Critical/Important findings.

- Full web suite: **411/411 passing** using isolated local SQLite.
- Isolated default-off production build and post-build TypeScript: passed.
- Browser inspection: desktop and 390px billing layout, interval selection,
  and deletion confirmation using a fake local account; no purchase or deletion.
- One built artifact served correct public copy with the runtime flag both
  disabled and enabled.
- Regression coverage includes stale-session recovery, provider outages,
  checkout completion/expiry/cancellation, uncertain provider responses,
  seat reservation races, and disabled/native recovery behavior.

The suite includes an expected diagnostic from an existing Terminal
provider-failure/retry test; that test passes. Real Stripe test-mode purchases,
physical-device acceptance, owner policy approval, and activation are **not**
completed by this verification. No live configuration, data, charges, push,
merge, or deployment was performed.

### Provisional implementation decisions

1. The original shared-cutoff proposal was superseded September 21 by one
   14-day trial per company, with the approved frozen legacy signup estimate.
2. Enforcement covers subscriptions and employee seats, not marketing feature
   bundles. A different tier policy requires additional feature restrictions.
3. Work stays on the local feature branch with billing default-off. Production
   testing and integration require a separate instruction.
4. Locked administrators can promote an existing employee to retain the
   last-administrator deletion recovery path. No owner role is introduced. If
   this policy is rejected, remove the narrow recovery API/UI before activation.
