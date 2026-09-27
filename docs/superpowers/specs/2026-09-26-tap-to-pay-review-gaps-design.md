# Tap to Pay review gaps: approved direction

## Intent and scope

Close the remaining app-side gaps identified against Apple's August 2026 v1.7 checklist while production Tap to Pay stays disabled. The user approved reader warm-up, authoritative merchant terms checks, declined receipts, and onboarding/launch preparation. They explicitly rejected building a native push system and approved persistent server-backed notices shown when Forge reopens instead.

This is architectural work split into three independently testable slices, in this order:

1. [Reader readiness and terms status](2026-09-26-tap-to-pay-readiness-design.md).
2. [Payment outcomes and declined receipts](2026-09-26-tap-to-pay-outcomes-design.md).
3. [Merchant discovery and launch preparation](2026-09-26-tap-to-pay-discovery-design.md).

Conversational direction is approved. These written specifications are proposed for review before implementation planning. No product code is changed by this design commit.

## Shared constraints

- No APNs, native push permission prompts, push credentials, new push provider, automatic operational email, or SMS notifications.
- No production enablement, deployment, live transactions, Apple terms acceptance, account unlinking, Apple submission, or customer announcement delivery in this work. Payment/auth merges require separate approval.
- Keep manual card entry available under the existing guards. Never release an unresolved payment reservation because of a notice, receipt, failed warm-up or UI dismissal.
- Stripe/server-confirmed payment facts remain authoritative. Native callbacks, navigation, transport failures and timeouts are not proof of success or decline.
- Preserve company, staff, Stripe connected account, Terminal location, environment and session boundaries. Unknown or changed identity fails closed.
- Debug-only isolated testing stays isolated; Release ignores test origin/simulation overrides. Source production signing and distribution provisioning are not changed.
- Use the current design system and existing cards, buttons, dialogs, typography, light/dark and accent tokens. No general-purpose notification center or unrelated redesign.
- Additive schema changes must be repeatable against legacy SQLite/libSQL data and must not introduce a login/startup migration failure. No production backfill or new historical alerts.

## Alternatives and decisions

Retaining the current reconnect-for-every-operation lifecycle is simpler but does not address reader warm-up or payment-screen latency. The selected design retains an idle connection only within a validated foreground merchant session and fully clears it at trust boundaries.

A complete native push system could reach users while Forge is closed, but it adds permissions, credentials and delivery infrastructure. The selected, user-approved alternative is a durable in-app notice on reopening, with explicit acknowledgment and an original-attempt recovery link. No claim is made that it reaches a closed app.

Approved payments retain Stripe-hosted receipts. Declines use a separate, provider-verified declined-transaction document rather than misusing a paid receipt or silently emailing a stored customer address.

## Release claims and external gates

Apple checklist 5.12's acceptance of reopen-only notices remains unconfirmed. The launch-notification interpretation must also be confirmed if Apple's review expects something beyond an in-app announcement. These are explicit review questions, not requirements marked complete by this implementation.

Real NFC acceptance, physical Stripe test-card availability, released supported iOS, live receipt delivery, approved marketing assets/copy, three recordings, publishing entitlement and App Store review remain distinct external gates. Simulated tests and code review do not satisfy them.

## Verification approach

Each slice receives failing behavioral tests before production changes, the full web suite, relevant native tests, and an isolated production web build. Reader work also requires a signed development build against the actual Stripe SDK and later physical latency evidence. Inspect changed UI at desktop and phone widths and in the signed test app without real charges. Perform an independent whole-branch review before requesting a merge.

## Sources and self-review

- [Apple checklist](https://apple.box.com/v/ttpoichecklist), especially 1.5-1.6, 3.1-3.4, 5.6, 5.10, 5.12 and 6.1-6.3.
- [Apple review guide](https://apple.box.com/v/ttpoiappreviewpdf).
- [Stripe reader connection and account linking](https://docs.stripe.com/terminal/payments/connect-reader?reader-type=tap-to-pay&terminal-sdk-platform=ios).

Self-review: slices have separate responsibilities; no-push scope and notification limits are explicit; no approved-payment receipt is fabricated for a decline; acknowledgment cannot unlock payments; rollout remains off. External approvals and unavailable brand assets are named gates rather than hidden implementation placeholders.
