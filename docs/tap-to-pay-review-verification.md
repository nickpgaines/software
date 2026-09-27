# Tap to Pay review-gap implementation — 2026-09-26

Branch: `feature/tap-to-pay-review-gaps`. Base: `0b0f618`.
No production deployment, enablement, customer delivery, live payment, Apple
terms acceptance or submission was performed.

## Evidence

- Full web suite: **699 passed, 0 failed** after review fixes.
- Standalone native coordinator/session/document suite: **39 passed, 0 failed**.
- Isolated Next.js production build: exit 0. Disposable local database, billing
  and Tap to Pay disabled; no production credentials.
- Isolated signed development build against the installed Stripe SDK: exit 0,
  `BUILD SUCCEEDED`. This is not an App Store distribution build.
- Default announcement content is null, its separate flag requires exact `true`,
  and the source iOS project retains ordinary entitlements/no release flag.
- Actual React components rendered in an isolated fake-data route at desktop and
  390px widths, dark/default and light/custom-accent themes. Checked ready and
  setup-required copy, announcement suppression/restoration during recovery,
  and explicit canceled-sharing feedback. No provider request was made.
- iPhone simulator Safari renders the same fake-data components. This does not
  verify the native bridge, NFC, or iPad activity-sheet presentation. AXe could
  not load SimulatorKit in the installed Xcode layout; XcodeBuildMCP captured
  the simulator, but a Safari onboarding tooltip obscured part of the page.

Temporary logs:
- `/private/tmp/forge-review-fixes-full.log`
- `/private/tmp/forge-review-document-green.log`
- `/private/tmp/forge-review-fixes-sdk.log`
- `/private/tmp/forge-review-build.hzw3LJ/build.log`

## Independent review and fix pass

One fresh-context, read-only whole-branch review covered `0b0f618..f7b98e0`.
The reviewer found no Critical issues, two Important issues and two Minors.
The author reproduced and fixed both Important findings. One Minor was upgraded
because it can bury a newly confirmed payment behind older notices.

1. **Reader-only invalidation must preserve authenticated recovery.** Three
   regressions failed on generation changes for rollout withdrawal, missing
   location and replacement location. They now pass, including a fresh foreground
   notice fetch and original-attempt link. Actual identity changes still reset.
2. **Historical document sharing needs an independent session pin.** Added a
   trusted-origin/cookie pin even without a reader context; cookie changes cancel
   the share and delete its file. Pending pins are lease-guarded against reset.
   Native tests failed before the helper existed and now pass. Existing tests
   separately verify private-file deletion and exclusivity. UIKit runtime sharing
   remains a device-verification gate.
3. **Do not backdate approval to intent creation.** A late-approval regression
   failed on the old creation timestamp. It now uses immutable first-observed time,
   explicitly labeled `time_basis: observed`, when provider completion time is
   unavailable. Verified cancellation timestamps retain `provider` basis. Duplicate
   observation does not move the timestamp. Full suite remains green.

The fix pass was verified with tests/builds, not a second independent review.

## Deferred minor findings

- A newly declined document in an already-open checkout requires closing and
  reopening checkout to refresh its history. Existing outcomes remain recoverable.
- “Card setup confirmed” describes Stripe SetupIntent completion, not guaranteed
  durable saved-card availability; the original attempt retains save-failure guidance.

## Decisions and tradeoffs

1. Keep callback/main-thread ownership and XCTest; no unrelated concurrency/test
   migration. Cost: older syntax.
2. Use the user's requested current checkout and feature branch. Cost: no extra
   filesystem isolation; unrelated files are preserved.
3. Pin and revalidate the server-selected location. Cost: an extra provider check.
4. Retain cold-operation teardown; only validated warmed readers are reused.
   Cost: first cold collection still reconnects.
5. Extract readiness mechanics into a testable controller. Cost: one focused file.
6. Background/reader-only invalidation preserves auth generation. Cost: recovery
   safety depends on operation leases; actual identity reset remains separate.
7. Consolidate visuals at the end. Cost: visual findings arrive later.
8. Bound Charge history at 100, fail explicitly when more exists. Cost: unusually
   long histories require support review.
9. Save-only recovery uses the customer's existing saved-card surface. Cost: the
   customer record must remain accessible.
10. Keep declined documents separate from approved receipts. Cost: an additional
    component and private list route.
11. Consolidate native share/device checks; they remain unverified, not inferred
    from a successful compile. Cost: another device pass before release.
12. Fresh read-only merchant eligibility is shared by setup and announcement.
    Cost: one additional Stripe lookup.
13. Use an in-flow announcement card with reference-counted blocks plus conservative
    legacy overlay detection. Cost: some full-screen surfaces can defer it.
14. Audience counts use cached charging status and syntactically valid selected
    location IDs. Cost: candidates are estimates, never current eligibility or
    permission to email; no production audience query was performed.
15. Mark fallback completion time as first observation rather than fabricate a
    provider time. Cost: delayed webhook/recovery delivery can delay its timestamp.
16. Keep the CLI on Node 22.13+ with a narrow built-in SQLite declaration rather
    than upgrade all web Node types. Cost: declaration maintenance if CLI API grows.

## Reviewer matters deliberately not treated as code defects

- Real NFC, latency, Apple acceptance of reopen-only notices/text receipts,
  marketing approval, released-device behavior and distribution/submission approval
  remain external gates. Cost: code completion is not permission to launch.
- Visual and iPad activity-sheet judgment is not supplied by the source reviewer;
  the author verified responsive web rendering, not native sharing. Cost: device
  presentation could still reveal a defect.
- The reviewer did not rerun full builds/suites; the author did after fixes. Cost:
  author-run tests are not a second independent review.
- No extra permission-revocation change: normal iOS Settings transitions background
  the app and tear down the reader. Cost: an unobserved OS lifecycle edge remains
  a device-test risk.
- Source inspection found no further actionable issue in the enumerated ownership,
  migrations, deduplication, acknowledgment, onboarding or announcement gates.
  This is limited review evidence, not proof of every possible runtime condition.
- Existing ledger deviations were considered reasonable; their costs are listed
  above rather than silently discarded.

## Next gate

Run the final development build on a physical device, including native share/cancel,
session switching and warm-reader recovery; verify iPad share presentation if
supported. Then obtain Apple's no-push/receipt-format confirmation, real NFC and
timing evidence, required recordings and distribution approval. See
`tap-to-pay-launch-drafts.md`. Merge, production deployment, flags and customer
delivery each remain separately gated.
