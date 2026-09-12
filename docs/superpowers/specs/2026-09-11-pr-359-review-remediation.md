# PR 359 Review Remediation Specification

## Goal

Make the Twilio registration, automated lifecycle texting, and iOS widget changes in PR #359 safe to ship without expanding the feature set.

## Requirements

1. Twilio status adapters must accept the exact uppercase statuses returned by Brand Registration and US A2P Campaign APIs. Campaign status must be read from `campaign_status`.
2. Only platform admins or staff with `settings.view_all` may read, refresh, or submit 10DLC registration data.
3. Registration attestations must be literal JSON booleans equal to `true`; truthy strings or numbers must fail validation.
4. Approved registrations are read-only. Brand and campaign rejection screens must not advertise an ineffective generic retry. Customer Profile and Trust Product failures may create a fresh resource when explicitly retried.
5. New submissions support only LLC, Corporation, Partnership, and Sole Proprietorship. Public and nonprofit registrations are withheld until their additional Twilio fields are modeled.
6. The business website must be an HTTPS first-party site, resolve only to public IP addresses at every redirect, and return a successful HTTP response. Validation must have strict timeout and redirect bounds.
7. Every explicit submission attempt updates `submitted_at`.
8. Registration advancement must hold a company-scoped database lease for the full state-machine attempt so simultaneous GET, POST, and callbacks cannot create duplicate paid Twilio resources. The lease must expire after a bounded interval for crash recovery.
9. Automated drive-start, drive-end, optional job-started, and job-finished SMS may send only when the customer has recorded transactional SMS consent on at least one estimate in the same company. Missing consent must be recorded as a skipped lifecycle outcome and must not create an outbound message.
10. iOS widget network results may mutate or expose data only if the credential that began the request is still active. Stale unauthorized responses must not clear a newer credential. Cache fallback must be reloaded against the active credential at response time.
11. Widget Keychain items use `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, including migration of existing entries on update.
12. Web logout revokes every active widget token for the authenticated staff member before clearing the session cookie. Client-side token cleanup remains best effort.
13. Widget ARR uses the same default semantics as the subscription report: tax included and paid cancellations from the last month included.
14. Every behavior above has regression coverage. Existing web and iOS tests and production builds must remain green.
15. Manual and Stripe-backed job payment attempts must be durably idempotent across browser retries and concurrent requests. A repeated key with identical input returns the original result; reusing a key for different input returns 409. Stripe creation calls receive deterministic provider idempotency keys.
16. Job lifecycle notifications use a durable outbox committed with the lifecycle transition/payment mutation. Pending rows are recoverable; concurrent drainers submit once; an interrupted `sending` row becomes `unknown` and is never automatically retried because Twilio message creation has no application idempotency key.
17. Operators can see pending, failed, and unknown lifecycle notification states on the job, retry failed sends, and explicitly confirm a possibly-duplicating retry for unknown sends. Payment success responses surface notification warnings without rolling back a valid payment.
18. Lifecycle message times use a validated, tenant-configurable IANA time zone. Existing companies default to `America/New_York` to preserve current behavior.

## Out of Scope

- Apple Pay.
- Changing partial-payment completion semantics, receipt policy, or historical payment reconciliation.
- Supporting public-company stock exchange/ticker fields or nonprofit-specific Twilio qualification in this release.
- Merging the PR; payment-adjacent changes require explicit approval before merge.
