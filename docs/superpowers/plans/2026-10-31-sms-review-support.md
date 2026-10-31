# SMS review support

## Approved scope / spec
Settings > Messaging should explain prolonged, provider-confirmed review and offer a direct Twilio Support link and copyable registration references. Do not create tickets or route through Forge support. Never blame Twilio on the strength of a local pending state or a failed status check. Match existing dark settings styling. Exclude credentials, EIN, contact and address details from the support summary.

## Design
Read only the current stage's Twilio resource with the tenant's credentials. Use its date_updated conservatively as the last provider update, never the original form date. Show guidance after 7 days for Trust Hub profiles/products, 2 days for brands, 10 days for campaigns. These are UI prompting thresholds, not guaranteed SLAs. Fail closed on missing resources, dates, pending status, mismatched identity, or failed refresh. Recheck local stage/resource after provider fetch to suppress concurrent transitions. No schema changes. Preserve current registration advancement.

Public DTO: local state, stage label, provider status, last update and checked timestamps, company name, account SID, resource SID and campaign service SID when needed. Clipboard summary uses only those fields. Direct link https://help.twilio.com/articles/360048500694 opens separately. Clipboard denial reveals selectable details. Explain that Twilio may require the platform account owner's involvement.

## Task 1: Implement and verify the complete support notice
1. Add failing tests for current-stage age, provider errors/statuses/mismatches, tenant isolation, safe summary, direct link and clipboard fallback. Run focused tests; expected failures before implementation.
2. Add read-only server helper, public DTO/summary, route integration, and dark responsive notice. Hide stale guidance during refresh and prevent out-of-order refresh results.
3. Run focused then full web tests; expected all passing. Build production web in isolated source copy without environment secrets; expected success. Inspect a fake-data visual preview.
4. Fresh-context review all changes; fix blockers and rerun relevant checks. Leave feature on its branch for user integration decision (no production changes in this task).

Sources: Twilio TrustProduct API date_updated and status; Twilio ISV onboarding brand review guidance; Twilio A2P 10DLC help; Contacting Twilio Support.
