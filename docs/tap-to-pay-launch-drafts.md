# Tap to Pay on iPhone — NOT APPROVED / DO NOT SEND

These are review drafts, not authorized marketing content. No email, SMS, push,
send endpoint or scheduled delivery is included. The separate announcement flag
defaults off and the approved content manifest remains null.

## Email draft for owner and Apple marketing review

Subject: Tap to Pay on iPhone is coming to Forge

With Tap to Pay on iPhone, eligible Forge businesses will be able to accept
contactless cards and supported digital wallets using a compatible iPhone.

Once your business has access, open Forge → Settings → Payments to review your
Stripe account, choose your business location and prepare your iPhone. An
authorized administrator may need to accept Apple's merchant terms. Manual
card entry remains available under the existing payment safeguards.

**Placeholder:** replace or approve this copy against Apple's current marketing
toolkit. Add only approved artwork and verified availability/device language.
Do not claim the feature is available until distribution approval and rollout.

## In-app draft for review

Title: Tap to Pay on iPhone

Body: Prepare your iPhone to accept contactless payments at the job. Check your
business setup in Payments settings before taking your first payment.

Actions: Set up Tap to Pay / Not now.

No Apple artwork is bundled. Production content must be separately reviewed,
versioned and added to `terminal-announcement-content.ts` with a review reference.
The content manifest, server rollout, separate announcement flag, fresh merchant
eligibility and native support must all permit display. No acknowledgment occurs
merely because content was fetched or hidden behind another screen.

## Read-only candidate audience preview

From `apps/web`, using Node 24:

```
node --no-warnings --experimental-strip-types scripts/terminal-announcement-audience.ts --fixture
node --no-warnings --experimental-strip-types scripts/terminal-announcement-audience.ts --db /absolute/path/to/authorized-local-copy.sqlite
```

The default uses a disposable in-memory fixture. Explicit database selection is
read-only; only SELECT is accepted. Output is three aggregate counts, never
email addresses, customer records or account identifiers. No network or delivery
provider is used. A production audience query needs its own scoped approval.

Candidates are present staff memberships with a connected, cached charging-enabled
company and a syntactically valid selected Terminal location ID. The schema has no
separate staff-active flag. Missing-contact count is a planning aid, not permission
to email. Cached records cannot prove current Stripe eligibility, a valid business
address, Apple terms acceptance, native-device support or the right to send marketing.
The app performs fresh eligibility and location validation before an announcement.

## Owner / release checklist — outstanding external gates

- Confirm Apple's acceptance of reopen-only in-app outcome notices for checklist
  5.12; no native push notifications were implemented, by user decision.
- Confirm Apple's acceptance of the private text declined-transaction document.
  A share action is not a guarantee of delivery. Approved receipts remain Stripe-hosted.
- Obtain and approve current Apple marketing toolkit copy/artwork and launch timing.
- Verify real NFC acceptance with physical Stripe test cards and a supported,
  released iOS version. Simulated readers and compiler checks do not establish this.
- Measure physical button-to-reader-sheet latency if claiming Apple's timing target.
- Record new-user, existing-user and checkout flows on a physical device with the
  final approved setup/launch path; complete Apple's checklist.
- Obtain the publishing entitlement (development entitlement is not distribution
  approval), correct provisioning and App Store review approval.
- Separately approve any production migration, merge/deployment, feature flag
  enablement and customer announcement delivery. None is authorized by these drafts.

## Technical evidence

Behavioral tests cover reader leases/session changes, immutable failed-tap history,
canonical-payment deduplication, private per-initiator acknowledgment, original-
attempt recovery, confidential document generation and gated announcement content.
The final verification report must distinguish these automated checks from actual
device sharing, physical NFC, Apple review and production rollout.
