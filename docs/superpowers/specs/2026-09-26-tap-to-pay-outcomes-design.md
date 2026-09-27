# Tap to Pay persistent outcomes and declined receipts

## Goal

Show users payment results they missed when they return to Forge, and let merchants share a confidential declined-transaction document. No native push, SMS or automatic email. This slice follows the [shared constraints](2026-09-26-tap-to-pay-review-gaps-design.md).

## Durable facts and ownership

Extend new Terminal attempts with an initiating staff identity separate from save-card consent. Keep legacy unowned attempts recoverable through existing job checkout; do not guess an owner or flood users with historical notices.

Store minimal immutable outcome observations tied to company, attempt, Stripe account, provider object/event identity and timestamp. Store per-initiator acknowledgment separately. Provider redelivery and concurrent reconciliation must converge on one observation, not duplicate notices. A new verified outcome has a new acknowledgment identity; acknowledging an earlier decline cannot suppress later information.

Only validated provider data establishes approved, declined or canceled results. Where available, verify an individual failed card-present Charge for the declined tap, including its account, intent, amount, currency, paid/status flags and safe card summary. A later successful retry on the same PaymentIntent must not rewrite an earlier decline or make a stale decline look like the current payment state.

An interrupted/unresolved attempt is a separate attention item labeled "Check payment status". It is not a decline, receipt, payment or authorization to retry. Existing canonical payment recording and unresolved-job uniqueness remain unchanged.

## In-app notices

On authenticated entry and foreground return, fetch private/no-store notices scoped to the current company and initiating staff. The server never accepts a recipient identity supplied by the browser. Deleted or unauthorized staff and account changes cannot expose another tenant's notices.

Display a prominent existing-style card with the job reference, safe outcome description and "Check payment status" or "View payment" action. Deep links reopen the original attempt in checkout; they do not automatically create, collect, cancel or confirm a payment. Do not expose client secrets, full card details or raw decline diagnostics in notice text.

Unread remains durable until the specific result is visibly presented and acknowledged. A failed fetch, navigation, hidden tab or component mount alone does not mark anything read. Acknowledgment is idempotent and same-origin protected. Acknowledging an unknown outcome does not resolve its attempt; the existing unresolved payment remains discoverable and blocking as before.

If provider reconciliation fails, retain the last known facts and clearly distinguish historical results from the unresolved current attempt. Offline UI must not claim a new outcome. No background polling when the app is closed, and no promise of closed-app delivery.

## Declined-transaction document

Keep existing approved Stripe receipts unchanged. Add a separately labeled declined document only when a failed card-present transaction is verified, never from an SDK error, timeout, canceled sheet, unsuccessful lookup or save-only intent.

The document identifies the merchant, amount/currency, transaction time, safe receipt reference and the declined outcome; include applicable provider-supplied card/receipt fields without raw card data. Explicitly distinguish the individual declined tap from any later payment on the same job. No payment row, customer-default change, saved card or receipt-email update is created by viewing/sharing a declined document.

Offer an explicit native share action (activity sheet) for a sanitized document. The user chooses the destination; do not silently use stored customer contact details. Browser fallback may download the same document. No publicly enumerable receipt URLs. Validate authorization/account binding again before generating a document and suppress stale responses after session/company changes.

Do not label opening the share sheet as delivery. Cancellation and share failure leave the document available and must never suggest taking another payment.

## Migration and verification

Use repeatable additive schema installation. Test an existing database without the new structures, repeated/concurrent initialization, legacy attempts with no actor, and rollback compatibility before deployment approval. New tables are indexed by tenant/actor/unread state and cascade consistently with account deletion.

Tests cover webhook/reconciliation races, duplicate delivery, decline then successful retry, multiple declines on one intent, successful payment once, foreign accounts, incorrect metadata/amount/mode, setup-only attempts, absent failed-charge evidence, unseen/acknowledged outcomes, stale acknowledgments and logout races. UI tests cover foreground return, empty history, loading/offline/error, shared-device account switching, link-to-original-attempt and no acknowledgment from hidden UI.

Apple's acceptance of reopen-only notices for checklist 5.12 is unconfirmed. The implementation and review notes must state this limitation rather than claim the requirement is fully satisfied.
