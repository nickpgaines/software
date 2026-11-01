# Nick: Tap to Pay owner handoff

Prepared September 27, 2026. Apple case **22319614**, team **TG27DQJ464**, app **app.forgecrm**.

**Start here. This is a development/recording handoff, not approval to launch.** Production stays disabled. The implementation and privacy correction are on main through `9605f3a` (PR 376). This handoff branch adds portable recording tools and current instructions; it does not turn on production payments.

## Nick's next actions

1. Give your agent this directory and [agent setup guide](agent-setup.md). Your agent can prepare the isolated environment; you do not need Andrew's Mac, old tunnel, test password or diagnostic build.
2. Reply to Apple's existing email with the first [email draft](apple-email.md), asking whether an explicitly labeled simulated-reader checkout video is acceptable. Do not assume simulation proves real NFC or guarantees approval.
3. Provide your agent access to the Apple team, your registered supported iPhone and **Stripe test-only** credentials through a secure channel. Do not paste secrets into the PR, docs or Apple submission. Approve any test merchant creation explicitly.
4. Obtain Apple's current marketing toolkit and approve the actual in-app announcement copy/assets and launch timing. The manifest remains deliberately `null`; your agent must install approved content in a reviewed change before recording that announcement. Existing drafts are not approved Apple assets.
5. Arrange an external camera (another phone or a suitable camera) and perform the three [recording flows](recording.md). You need one merchant iPhone; the second device is only a camera. Nick must control Apple Account choices and merchant/legal acceptance. If Apple requires physical test-card evidence, obtain the supported test card and perform that test rather than calling a simulation a real tap.
6. Review the actual videos and official checklist, then reply/upload through Apple's existing case. Publishing entitlement, refreshed distribution provisioning and App Store review are later gates. Production enablement requires a separate explicit decision.

## What the agent can do without owner decisions

- Build a clean recording environment, generate fresh fake accounts/jobs, prepare configuration, and run automated checks.
- Draft correspondence, help operate the camera/assemble video evidence, and complete factual checklist entries with real timestamps.
- After Nick supplies assets/approvals, wire approved announcement content, configure his signing profile, and verify his device build.

**Do not describe this as "only press Record."** Owner inputs gate some remaining agent work: approved announcement content, test merchant onboarding/terms state, device provisioning and Apple's accepted recording method. No unresolved engineering defect is being concealed as an owner task; unverified cross-device/provider behavior must still be checked on Nick's setup.

## Evidence and limits

See [handoff verification](verification.md) for the fresh 709-test/build/integration results and their limits.

- Development entitlement installation, Apple terms/education and simulated-reader workflows were exercised on Andrew's registered iPhone. That does not provision Nick's device.
- Simulated payment/save, cancellation, same-attempt recovery and declined-document sharing were exercised. Recorded test evidence included one recovered charge without duplication, and a canceled attempt with zero charges.
- Privacy fix: required-reason `SystemBootTime / 35F9.1`, 40 passing native tests, successful unsigned device build and packaged-manifest inspection. Independent review found no blockers. Web production-format build passed.
- The no-push approach was selected intentionally. Persisted in-app notices appear when Forge is reopened. Apple has not approved this interpretation; disclose it in the submission, rather than claiming an exception.
- Native NFC, real contactless wallets, protected-screen recordings, receipt delivery and distribution approval are **not** established by simulations or compilation.
- The recording gateway blocks webhooks and cron. It tests interactive reconciliation, not background webhook delivery. Existing automated webhook coverage is separate evidence.

The old `docs/tap-to-pay-release.md` snapshot and output-folder reports contain historical status. This directory supersedes their current-status conclusions, not their dated evidence.

## Do not transfer

Do not share Andrew's temporary databases, keys, session cookies, onboarding links, signed diagnostic build, raw logs or expiring tunnel URLs. The new workspace generates separate credentials. Do not record passwords, Apple identifiers, key files or private entry links.

## Official references

- [Apple entitlement review guide](https://apple.box.com/v/ttpoiappreviewpdf)
- [Official App Review Requirements Checklist](https://apple.box.com/v/ttpoichecklist) — use the actual Numbers document, not only our worksheet.
- [Apple Tap to Pay](https://developer.apple.com/tap-to-pay/)
- [Stripe test methods](https://docs.stripe.com/terminal/references/testing) — simulated reader and physical test-card evidence are distinct; mobile wallets are not supported in Terminal test mode.
- [Apple marketing guidelines](https://developer.apple.com/tap-to-pay/marketing-guidelines/)
