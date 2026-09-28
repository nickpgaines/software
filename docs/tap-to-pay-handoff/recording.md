# Recording script and evidence checklist

Use Apple's [current guide](https://apple.box.com/v/ttpoiappreviewpdf) and [official checklist](https://apple.box.com/v/ttpoichecklist) as authority. This is an internal worksheet, **not a completed Apple checklist**. The inspected guide was downloaded as version 1.7; its footer still said 1.6. Check the current revision when submitting.

## Before recording

1. Confirm Apple's accepted checkout method. Stripe simulation is not real NFC evidence. No live transaction is authorized by this document.
2. Use a clean, reviewed development build on Nick's registered device, not Andrew's temporary diagnostic build. Record the commit, app build, device/iOS version, environment and test-reader mode.
3. Film a ten-second sample using an external camera; verify the amount, phone screen and protected payment UI are readable. Apple's inspected guide requires externally filmed checkout because ordinary screen recording omits protected screens. Do not substitute mirrored screens or mock UI.
4. Open private entry links, sign in and configure credentials **before** recording. Keep passwords, Apple identifiers and tokens out of frame. Disclose edits; do not splice success screens from unrelated attempts.
5. Confirm approved awareness content and terms-not-yet-accepted state are available. If either is absent, that shot is blocked, not complete.

## 01 — New-user flow

Filename: `Forge_01_New_User.mp4`.

1. Start at sign-in, choose signup and register a new fake company using the real form.
2. Open Settings → Payments, start Stripe test Express onboarding, and complete the permitted test-business flow. Nick handles credentials/attestations.
3. Return to Forge and show actual onboarding status. If verification is asynchronous, say so and resume the same merchant later; do not fake instant approval.
4. Show the Tap to Pay setup entry and next action. Follow Apple's checklist if it asks for terms/education in this video as well.

## 02 — Existing-user flow

Filename: `Forge_02_Existing_User.mp4`.

1. Sign in as an existing merchant and show the **actual approved** awareness communication, then follow its setup action.
2. In Payments, show business readiness and selected location.
3. As an authorized administrator, select the authorization checkbox and Prepare this iPhone. Nick controls acceptance of Apple's terms and Apple Account choice if prompted. The checkbox itself is not Apple's acceptance.
4. Show Apple's How to Tap education, preparation progress and ready state.
5. Reopen How to Tap from Payments to show ongoing discoverability.
6. Supporting clip: show ordinary staff receiving administrator guidance when business terms are not accepted. Never modify staff permissions just to bypass this.

## 03 — Checkout flow (external camera)

Filename: `Forge_03_Checkout.mp4`.

1. Open a fresh unpaid fake job; show its amount and checkout totals.
2. Show the Tap to Pay on iPhone action and existing payment alternatives.
3. Tap the action, preserving initialization/preparation feedback in the video.
4. Present the Apple-approved test method. Label simulation explicitly if Apple accepts it.
5. Wait through processing, then show server-confirmed success and the paid job balance.
6. Open the approved-payment receipt. A share sheet or email-request success is not proof of delivery.

Supporting evidence: canceled/unknown attempt → Check status → same-attempt recovery; decline → Declined taps → private document sharing; explicit consent → save card → customer saved-card list. Do not collect twice to fix uncertainty. Failed-document sharing is distinct from an approved receipt.

## Fill in from actual evidence

| Item | Result / video timestamp / explanation |
| --- | --- |
| Commit, app version/build, device, released iOS version, date | Pending |
| Test environment and permitted payment method | Pending Apple method confirmation |
| New account → onboarding → return/status | Pending recording |
| Existing merchant awareness, setup, Apple terms and education | Pending approved content and recording |
| Preparation progress and reusable How to Tap | Pending recording |
| Amount → collection → processing → canonical confirmation | Pending recording |
| Approved receipt and decline documentation | Pending recording; do not claim delivery without evidence |
| No-push/reopen notice behavior | Implemented; disclose behavior, Apple acceptance unconfirmed |
| Real NFC, wallet and latency evidence | Not established by simulation; do not mark Yes without performing |
| Official Numbers checklist completed honestly | Pending |
| Nick watched exported videos and approved submission | Pending |

Preserve full errors/waits and actual timestamps. Resolve required gaps before sending the final package. One merchant iPhone can be reused sequentially; the separate camera is for filming, not a second merchant installation.
