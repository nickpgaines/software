# Forge Tap to Pay and tap-to-save

## Approval and scope

The user approved both in-person job checkout and saving a card without an immediate charge. The user approved the proposed flow and explicitly delegated written-spec review and implementation on 2026-09-16. No additional approval checkpoint is required for local implementation.

This is a native Stripe Terminal integration, not an Apple Pay button on a website. Excluded: Forge SaaS paywall, external readers, Android Terminal, offline payments, tips, refunds, automatic subscription activation, live charges, production configuration changes, entitlement submissions, and App Store uploads.

## User flows

1. Job checkout retains the existing Tap to Pay button. On a supported new iOS build it opens the native flow for the server-calculated outstanding USD job balance. An unchecked save-card option presents consent text before collection. Confirmation updates the job only after server verification. Payment success and saving success are separate outcomes.
2. Customer payment methods gain Save card with a tap. Consent is required. This creates a Terminal SetupIntent, never a PaymentIntent. Successful setup stores the reusable generated card, not the card-present token.
3. Saved Terminal cards are marked explicit-selection-only. Saving never changes customer billing defaults, silently supplies a fallback card to an existing subscription, activates a subscription, or charges it. A subscription can explicitly select a saved card in its own payment-method action; changing an active Stripe subscription updates its default without charging or prorating. Existing subscription acceptance/signature requirements remain intact.
4. Unsupported app versions, browsers, Android, denied permissions, unavailable entitlement, and incompatible devices retain manual card entry and clear actionable messaging. Capability detection does not initialize a reader or request permissions on app launch.

## Architecture

Use the existing connected-account direct-charge model. New server Terminal attempt service owns authorization, durable idempotency, consent, creation, reconciliation, cancellation, and generated-card persistence. Routes remain thin. Existing job payment recording and completion notifications are reused, with the same deduplication protections.

Native `ForgeTerminal` Capacitor plugin owns Stripe Terminal SDK initialization, reader education/discovery/connection, collection, cancellation and session cleanup. The web layer owns authenticated attempt creation and reconciliation. Native fetches fresh ConnectionTokens from the fixed trusted Forge origin using the current WebView session, never a caller-supplied URL. Account identity must match the server attempt before a reader session is used.

Use official Stripe Terminal iOS SDK via Swift Package Manager, an exact verified 5.x release, linked to the app target (not the Capacitor-generated package manifest). Current documentation exposes processPaymentIntent/processSetupIntent; implementation must compile against the pinned SDK headers rather than rely on remembered names. Keep current deployment target unless the actual dependency requires a change. No secrets, complete card data, or connection tokens in logs, persisted browser storage, or application database.

## Server contract

All routes require a company session and same-origin mutation protection. The connected account is resolved from the company, never accepted as authority from a client.

`POST /api/stripe/terminal/attempts`, header `Idempotency-Key`, body:

```ts
type TerminalConsent = { accepted: true; version: "terminal-save-v1"; customer_name: string };
type StartTerminalAttempt =
  | { operation: "payment"; job_id: number; save_card: boolean; consent?: TerminalConsent }
  | { operation: "setup"; customer_id: number; consent: TerminalConsent };
type TerminalAttemptView = {
  attempt_id: string;
  operation: "payment" | "setup";
  status: "ready" | "processing" | "succeeded" | "canceled" | "needs_reconciliation";
  stripe_account: string;
  terminal_location_id: string;
  client_secret?: string; // only for a resumable intent; never persisted in browser
  amount_cents: number;
  customer_id: number;
  job_id: number | null;
  save_card: boolean;
  payment_recorded: boolean;
  card_saved: boolean;
  warning: string | null;
};
```

`POST /api/stripe/terminal/attempts/:id/reconcile` returns the same view after retrieving canonical provider state and applying idempotent local effects. `POST .../:id/cancel` first retrieves the provider state, cancels only a cancellable intent, and reconciles a successful payment rather than reporting it canceled. `GET /api/stripe/terminal/attempts?job_id=N` or `?customer_id=N` returns `{ attempts: TerminalAttemptView[] }` for recoverable active attempts; no client secrets on this listing.

POST creation returns the existing attempt for an identical replay, rejects changed parameters, and refuses a second unresolved payment attempt for the same job even under a different key/device. An attempt is durably claimed before provider creation. If creation has an ambiguous outcome, never create another provider intent after Stripe's idempotency retention window. Reconcile by durable provider ID or exact metadata lookup; if inconclusive, remain blocked with a recovery message. Known pre-provider validation failures do not strand the job. Persist the connected account per attempt and reject account remapping.

Payment amounts come from the current job balance, not client-supplied amounts. Validate integer cents, positive remaining balance, ready Stripe account, job/customer/company ownership. Save canonical fingerprint and audit consent version/name/time/staff with the attempt. Save-card requests include the customer and setup_future_usage=off_session; setup requests use card_present and usage=off_session. Both keep allow_redisplay restrictions, including wallet restrictions.

Terminal location readiness is validated before claiming an attempt. The old helper fabricates missing address fields; the new flow must never use that shortcut. Validate a cached location against the connected account, reuse an unambiguous real configured US location, or create one only from a complete verified merchant address. Missing/ambiguous location configuration returns an actionable setup-required message without creating an intent or stranded attempt.

`POST /api/stripe/terminal/connection-token` accepts `X-Forge-Stripe-Account` for native account matching, checks it against the authenticated company before minting a token, and returns the existing `{ secret, stripe_account }` shape. The header is a consistency check, not authentication.

Generated cards are resolved from expanded latest_charge for payment or expanded latest_attempt for setup. Validate account/customer and consent metadata before saving. Missing generated_card produces a clear fallback warning. A successful job payment is never refunded or relabeled failed because saving failed. Webhooks reconcile attempts to recover when the app disappears; database failures must remain retryable instead of swallowed. Setup webhooks must distinguish Terminal setup from ordinary web SetupIntents.

Add a requires_explicit_selection flag to saved methods, default 0 for existing cards, 1 for new Terminal-generated cards. All automatic customer-card fallback queries exclude this flag; explicitly selected cards remain usable. Existing customer defaults and subscriptions are unchanged. Terminal saves never mirror a new customer default to Stripe. For wallet-generated cards preserve limited redisplay and restrict use to approved off-session recurring flows.

`PUT /api/customer-subscriptions/:id/payment-method` accepts `{ payment_method_id: number }` (Forge saved-method row ID). Verify company/customer ownership, active usable card and existing accepted subscription. Update the Stripe subscription if present, then the local explicit reference; do not create a subscription or charge. Existing creation/activation can accept explicit saved-method selection with the same ownership validation and unchanged terms/signature checks.

## Native contract and security

```ts
interface ForgeTerminalPlugin {
  getCapabilities(): Promise<{ supported: boolean; reason?: string }>;
  showEducation(): Promise<void>;
  collectPayment(args: { operationId: string; clientSecret: string; stripeAccount: string; locationId: string; saveCard: boolean }): Promise<{ intentId: string }>;
  collectSetup(args: { operationId: string; clientSecret: string; stripeAccount: string; locationId: string }): Promise<{ intentId: string }>;
  cancel(): Promise<void>;
  reset(): Promise<void>;
}
```

Only allow trusted top-level HTTPS Forge origins. Debug-only localhost may be used for isolated test work; Release must not accept arbitrary origins, simulation flags, or API endpoints from JavaScript. Use current matching WebView cookies only for the fixed backend request, reject redirects and unexpected accounts. Do not cache tokens or cookies across operations. Serialize one operation at a time. Initialize SDK once lazily. Before a different operation disconnect any old reader and clear cached credentials; fail closed if cleanup cannot finish. Generation checks prevent late callbacks changing a new operation. Cancel collection on background, logout/reset, or WebView departure; an uncertain in-flight confirmation remains reconcilable server-side. A browser success callback is never proof of payment.

Show Apple's merchant education before first collection and provide a way to show it again. Register plugin explicitly alongside ForgeWidgetPlugin. Do not enable an unapproved entitlement in the standard signing configuration: supply a clearly documented opt-in entitlement file/build setting for development and distribution provisioning. The shipped default build must explain unavailability until entitlement/provisioning is enabled. Simulator payment mode is strictly Debug/test-only, never a JS production switch.

## Web coordination

Create a focused native-terminal module plus reusable TerminalFlow component. Create/recover attempts before invoking native collection; disable repeat taps synchronously. Persist only opaque attempt IDs, scoped to account/target, when useful for reload recovery; server listing remains the source for multi-device recovery. Errors reconcile the same attempt; never turn an unknown outcome into a new charge. On success refresh existing payment/customer UI. On component unmount cancel native collection without deleting the server attempt. Logout resets Terminal before allowing another session's reader work.

Consent copy identifies the merchant and states that saving is optional, no subscription starts from saving alone, and recurring billing requires separately agreed amount/schedule/cancellation terms. Capture a customer-entered name and unchecked consent checkbox; record versioned text evidence. Display only safe card summary fields. Merchant confirmation alone is not an automatic subscription authorization.

## Verification and release gates

- Unit/integration tests exercise production routes/services with real SQLite and provider-boundary doubles: authorization, amount calculation, duplicate requests, creation ambiguity, cancellation races, payment success/save failure, generated-card resolution, webhook retries, explicit-selection isolation, and consent.
- Web interaction tests exercise new/old bridge capability, tap-save/pay toggles, cancellation, recovery and stale/unmounted callbacks.
- Native behavioral tests exercise serialization, generation cleanup, origin/account checks and cancellation through a provider boundary. Build the actual Stripe adapter against the pinned SDK and run simulator tests. No source-text-only tests standing in for behavior.
- Run complete web tests, typecheck/production build, iOS simulator build/tests, and independent task plus final review.
- Document Apple development/distribution entitlement steps, Stripe Connect readiness/location, rollout gate, physical iPhone checklist, and explicit list of unverified hardware/live behavior. Do not claim live Tap to Pay works from mocks or simulator alone.

## Sources checked

- https://docs.stripe.com/terminal/payments/setup-integration?terminal-sdk-platform=ios
- https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=ios
- https://docs.stripe.com/terminal/payments/connect-reader?terminal-sdk-platform=ios&reader-type=tap-to-pay
- https://docs.stripe.com/terminal/features/saving-payment-details/save-directly?terminal-sdk-platform=ios
- https://docs.stripe.com/terminal/features/saving-payment-details/save-after-payment?terminal-sdk-platform=ios

## Self-review

Scope, interfaces, payment-vs-save outcomes, account isolation, consent, hardware verification and signing gates checked. Corrected the implicit-default hazard: existing fallback queries select any saved card, so merely saving with is_default=0 is insufficient. Explicit-selection isolation and subscription selection are required together. Approval to implement is delegated by the user; no production or signing-account mutation is implied.
