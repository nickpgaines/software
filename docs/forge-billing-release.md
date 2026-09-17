# Forge company billing release runbook

## Dormant by design

This implementation does not activate itself. `FORGE_BILLING_ENABLED` must be
the exact string `true`; a missing value, `false`, or any other value preserves
the existing CRM, Settings billing placeholder, public copy, and access rules.
The cutoff is never an activation trigger. Do not enable billing, merge or
deploy an enabling configuration, provision live Stripe objects, notify
customers, or change production data without a separate owner approval.

The proposed policy remains provisional:

- Shared access ends September 26, 2026 at 00:00 America/Chicago
  (`2026-09-26T05:00:00.000Z`). New companies do not receive individual trial
  extensions.
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

Choosing Checkout before the cutoff starts paid billing immediately. There is
no additional Stripe trial and no automatically deferred first charge.

## Configuration inventory

Use a dedicated Stripe platform billing setup. Never fall back to the existing
Stripe Connect credentials used for homeowner payments.

| Variable | Sensitivity | Requirement |
| --- | --- | --- |
| `FORGE_BILLING_ENABLED` | Non-secret rollout control | Exact `true` only after all gates pass. Keep false/missing while dormant. |
| `FORGE_BILLING_CUTOFF_AT` | Non-secret policy | ISO timestamp with timezone. Defaults to `2026-09-26T05:00:00.000Z`. |
| `FORGE_BILLING_STRIPE_SECRET_KEY` | Secret | Dedicated `sk_test_…` or `sk_live_…`; mode must match. |
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

## Dedicated Stripe test setup

1. Create or select the dedicated Forge platform Stripe account in test mode.
   Record its account ID and a restricted test secret suitable for Checkout,
   Customers, Subscriptions, Invoices, Prices, and Billing Portal operations.
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

- browser acceptance for administrators, ordinary employees, pre-cutoff,
  unpaid, paid, past-due, scheduled cancellation, expired entitlement,
  provider outage, stale session, export, logout, support, and both account
  deletion scopes;
- real Stripe test-mode evidence for all six Prices, Portal, webhook retries,
  lost-response recovery, and canonical invoice entitlement;
- the cutoff/timezone, prices and founder duration, permissions, feature-tier
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
