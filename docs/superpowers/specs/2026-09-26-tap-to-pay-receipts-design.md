# Tap to Pay receipts and outcomes

## Intent and authority

Complete the receipt portion of the authorized Tap to Pay checkout, including access after checkout is dismissed. Tap-to-save is not a payment and must never produce a payment receipt. The user delegated spec self-review and implementation; production enablement, merges, real transactions, and Apple's distribution approval remain separate gates.

This is a cross-component (architectural) change, implemented on a follow-on branch from `4e03241`. Existing Admin/custom-role behavior is unchanged. No Owner role, database migration, or production configuration change.

## Chosen approach

Offer Stripe's prebuilt email receipt after a verified successful, captured card-present payment. Also offer the Stripe-hosted receipt when available. This uses Stripe's required card-network fields instead of extending Forge's generic manual-payment email. A custom EMV receipt renderer would duplicate Stripe's receipt logic; silently emailing the customer's stored address would remove the customer's choice. Neither is selected.

Official reference: https://docs.stripe.com/terminal/features/receipts — updating the successful PaymentIntent's `receipt_email` requests a receipt after checkout; test payments do not automatically send emails. Receipt generation is not proof of delivery.

## Server contract

- Authenticated GET `/api/stripe/terminal/receipts?job_id=N` lists this company's recorded, successful Terminal payment attempts for the job, newest first. It is database-only and includes no provider secrets or customer contact details. Other-tenant jobs return 404. This list does not change unfinished-attempt locking.
- GET and same-origin POST `/api/stripe/terminal/attempts/[id]/receipt` load the company-scoped attempt, verify the currently connected Stripe account and configured provider mode, and retrieve the bound PaymentIntent. Reuse existing metadata/amount/customer validation, additionally checking exact provider intent identity.
- Require a successful PaymentIntent and its captured, paid, successful card-present charge; verify charge-to-intent, USD amount and live/test mode. Unknown, pending, canceled, declined, and setup attempts cannot send a payment receipt. A later refund is reported, not mislabeled as a new payment; hosted receipt reflects current status.
- GET returns a minimal receipt view: attempt ID, amount, refunded amount, payment timestamp, test flag, and a nullable HTTPS `pay.stripe.com/receipts/` URL. Never return client secrets, card payloads, arbitrary URLs, or a stored recipient.
- POST accepts only an explicitly entered valid email (trimmed, max 254 characters, no control characters). Only `receipt_email` is updated. No confirm/capture/create/cancel calls, no customer contact edits, no new payment record, no webhook or SMS side effects. Account/mode checked immediately before update. Stable charge-and-email-scoped idempotency protects retry/double-clicks within Stripe's retention window; this is not an indefinite exactly-once delivery promise.
- Return `requested` in live mode, `test_only` in test mode, never `delivered`. A provider error yields a receipt-specific retry message that says not to collect payment again. Existing receipts remain available when rollout is off or charging is disabled, provided the original connected account remains configured.

## UI and outcome behavior

Reuse Button, Input, Label and documented card/token styling. Add a small receipt panel in job checkout, automatically selecting the newly confirmed payment, and a list of previous Tap to Pay payments when checkout is reopened. Empty history is invisible. Receipt lookup/sending must never acquire or release payment locks or run collection/reconciliation. Loading/error/retry, test-mode, refunded, and requested states are explicit. Errors retain recipient input. Selection/job/account lifecycle changes suppress stale results and prevent stale sends; synchronous in-flight locking prevents duplicate submissions.

Only Stripe `card_declined` errors on a currently `requires_payment_method` PaymentIntent produce a declined result. Keep its original attempt reserved until canceled/recovered; say that the tap was declined and that the original attempt can be retried or canceled. Cancellation remains cancellation; transport/provider errors remain unknown. Do not infer a decline from an SDK exception or fabricate a paid receipt.

## Verification and remaining gates

Tests execute real routes/services with disposable SQLite and a fake Stripe transport, plus real React handlers via the existing UI harness. Cover tenant/account/intent binding, email validation, mode and rollout behavior, no financial side effects, declined/canceled/unknown distinctions, duplicates, selection/unmount/session races, receipt failure independence, and reopening history. Run the entire web suite and production build with disposable SQLite; visually inspect the panel at phone width.

Actual receipt delivery, supported physical-device NFC tests, tap-to-save end-to-end, and exact Apple case checklist remain unproven until their separate external tests. In particular, this phase does not claim that a successful-payment receipt alone satisfies every Apple requirement for unsuccessful transaction documentation.

## Self-review

Checked scope, delivery claims, tenant isolation, mode checks, payment-lock independence, historical access, and distinction between payment and card saving. No unresolved implementation choice; external evidence is explicitly separated from code completion.
