# Tap to Pay discovery and launch preparation

## Goal

Make Tap to Pay discoverable to eligible new and existing merchants and prepare launch communications without exposing unfinished functionality or sending announcements. This slice follows the [shared constraints](2026-09-26-tap-to-pay-review-gaps-design.md).

## In-app entry points

After Stripe onboarding returns successfully, refresh server eligibility and offer a clear route to Payments settings for Tap to Pay setup. Do not infer approval from a return URL alone. Incomplete onboarding shows the existing requirements flow; unsupported devices retain normal card payments.

Prepare a once-per-user rollout announcement using existing modal/card primitives, with "Set up Tap to Pay" and "Not now" actions. Persist acknowledgment by company, staff and announcement version so account switching and future versions remain independent. Do not display it while collection, recovery confirmation or another critical modal is active.

The announcement is gated by server rollout, native capability, merchant eligibility and separately approved launch content. No announcement or readiness claim appears just because the code is deployed. Settings remains a persistent entry point after dismissal.

Use "Tap to Pay on iPhone" consistently. Do not use a custom Apple logo or improvised contactless artwork. Apply approved assets/copy from Apple's marketing toolkit once available, within Forge's documented layout/tokens; no marketing compliance claim is made for placeholder artwork or draft prose.

## Launch materials and limits

Prepare launch-email and in-app announcement drafts, eligibility rules and a dry-run recipient-count procedure. Do not send, schedule or create a bulk-send endpoint in this slice. Use a separate owner-approved launch action later.

Native push remains excluded by user decision. If Apple's marketing review requires native push beyond the approved in-app announcement, obtain clarification or an exception rather than silently adding APNs or marking that checklist item complete.

Approved marketing toolkit assets/copy are an external prerequisite for final launch content. If unavailable, code placements and test fixtures may be prepared but the production announcement must remain gated off and explicitly reported incomplete.

## Verification

Test disabled rollout, unsupported/old apps, incomplete Stripe onboarding, successful verified onboarding, user/company changes, repeated visits, acknowledgment versioning, duplicate responses and critical-modal suppression. Inspect at phone and desktop widths in light/dark themes with default and custom accents. Verify no email/SMS/push provider invocation and no production configuration changes.

Do not record Apple's final new/existing-user flows until the actual approved launch and setup paths are available in the isolated development build. Apple submission and customer rollout remain separate approvals.
