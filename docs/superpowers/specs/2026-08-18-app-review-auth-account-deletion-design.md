# App Review Authentication and Account Deletion Design

**Date:** 2026-08-18
**Status:** Approved in conversation
**Classification:** Architectural

## Context

Apple rejected Forge 1.0 (2) under:

- Guideline 4.8 because the iOS app offered Google Sign-In without an equivalent privacy-preserving login service.
- Guideline 5.1.1(v) because users can create accounts but cannot initiate account deletion inside the app.

Forge is a hosted Next.js CRM wrapped by a Capacitor iOS/Android shell. The same login page is served to normal web browsers and native webviews, so authentication options must be selected by runtime environment rather than by maintaining a separate mobile login implementation.

## Goals

1. Keep Google Sign-In available on the public website while removing it from both Capacitor apps.
2. Add an easy-to-find, complete account-deletion flow under Settings > Profile.
3. Delete only the signed-in employee when other employees remain.
4. Delete the entire organization when its last employee deletes their account.
5. Prevent the final administrator from leaving while non-admin employees remain.
6. Ensure deleted employees cannot keep using an old session from another device.
7. Produce a flow that can be demonstrated clearly in Apple's required physical-device recording.

## Non-goals

- Adding Sign in with Apple.
- Removing Google Sign-In from the website.
- Introducing a permanent company-owner role or ownership migration.
- Reworking the broader role and permission system.
- Deleting independently owned Stripe merchant accounts or provider records that Stripe or Twilio must retain under their own policies.
- Resolving unrelated App Store preflight findings in this change. The iOS privacy-manifest finding will be verified separately before resubmission.

## Decisions

### Google Sign-In remains web-only

Normal browsers continue to show and use Google Sign-In. Capacitor iOS and Android shells offer only Forge's first-party email/password authentication.

Native detection must fail closed on the login page: the Google section is absent while the runtime is unknown and appears only after the client has confirmed it is running in a normal browser. This prevents a server-rendered or hydration-time flash of the Google button during App Review.

The native shell also establishes a non-privileged native-app marker. Google OAuth's start endpoint rejects marked native requests, so the restriction is enforced at the entry point as well as in the interface. Spoofing this marker can only hide or disable Google Sign-In; it cannot grant access or privileges.

Existing Google OAuth routes, helper code, account-link rows, and configuration remain in place for website users. Mobile users who previously relied on Google can establish a password through the existing password-reset flow.

### Deletion is based on current employee counts

Forge will not add an owner concept. At deletion time the server counts the organization's current employees and administrators:

- If more than one employee exists, delete only the signed-in employee.
- If the signed-in employee is the final administrator but other employees remain, block deletion until another employee is promoted to administrator.
- If the signed-in employee is the last employee, delete the entire organization and its tenant-owned data.

These counts are advisory when shown in the interface and authoritative only when recalculated inside the deletion transaction. This handles another administrator adding, removing, or promoting an employee while the confirmation dialog is open.

## User experience

### Location

Every real staff account receives a **Delete account** danger zone at the bottom of Settings > Profile. The built-in environment/platform administrator does not receive this option because it is not a tenant staff account.

The surface uses existing Pulse primitives and tokens:

- `Button` with the destructive variant.
- `Dialog` for confirmation.
- `Input` and `Label` for reauthentication and typed confirmation.
- Existing card, border, text, and mobile safe-area conventions.

No new visual primitive is needed.

### Preview states

Opening the dialog loads a server-generated deletion preview containing the company name, employee count, administrator count, and resulting scope.

1. **Employee-only deletion**
   - Explain that the employee's login, profile, and personal connections will be deleted.
   - Explicitly state that the organization and its CRM records will remain available to the other employees.
   - Require the current password before enabling deletion.

2. **Last-administrator block**
   - Explain that the organization would have no administrator.
   - Disable deletion.
   - Link the user to Employees so another employee can be promoted first.

3. **Organization deletion**
   - Clearly identify the user as the last employee.
   - State that deleting the account also permanently deletes the organization, employees, customers, jobs, messages, invoices, settings, and other CRM data.
   - Require the current password and a typed `DELETE` confirmation.

After successful deletion, clear the session and return the user to Login with a neutral success confirmation. Errors remain in the dialog and never imply that deletion succeeded.

## Server API and data flow

### Preview

`GET /api/account/deletion` requires a valid tenant staff session and returns a small view model:

```ts
type AccountDeletionPreview = {
  scope: "employee" | "organization";
  companyName: string;
  employeeCount: number;
  adminCount: number;
  blockedReason: "last_admin" | null;
};
```

The preview is not authorization. The delete operation repeats every check.

### Deletion

`DELETE /api/account/deletion` accepts the current password and, for organization deletion, the typed confirmation.

The route:

1. Resolves the current tenant staff row and verifies its password hash.
2. Reads the organization's integration identifiers needed for cleanup.
3. Starts a database transaction.
4. Re-reads the current employee and administrator counts.
5. Returns a conflict response if the expected scope changed or the last-administrator safeguard now applies.
6. Deletes the current staff row when other employees remain, or deletes the company row when this is the last employee.
7. Commits, syncs the embedded replica, clears the session cookie, and returns the completed scope.

Expected response classes:

- `401`: missing/expired session or incorrect password.
- `403`: built-in platform account or otherwise ineligible identity.
- `409`: team composition changed, last-administrator safeguard applies, or confirmation no longer matches the resulting scope.
- `500`: deletion did not commit; the account remains available and the cookie is not cleared.

## Deletion boundaries

### Individual employee

Deleting a staff row relies on and verifies the schema's existing foreign-key behavior:

- Delete password-reset tokens, Google account links, MCP authorization records, shifts, and direct staff assignments that use `ON DELETE CASCADE`.
- Null historical attribution fields that use `ON DELETE SET NULL`, preserving organization-owned job, payment, estimate, invoice, review, task, and activity history for the remaining employees.
- Delete or detach any additional staff-scoped records discovered by the schema audit.

### Entire organization

Deleting the company row is the root operation. Direct tenant-owned tables should cascade through `company_id`; child tables should cascade through their parent records.

Before implementation, the schema inventory must prove that every tenant-owned table is either:

- directly tied to `company(id) ON DELETE CASCADE`,
- transitively tied to a cascading parent, or
- explicitly deleted in the organization-deletion service.

The implementation must test that no tenant row remains after deleting a populated fixture company. Shared platform records, such as global OAuth client registrations or webhook-event deduplication rows, are not tenant-owned and are not deleted.

### Connected services

For organization deletion:

- Deauthorize a Standard Stripe Connect account when configuration permits. Express accounts remain Stripe-owned; Forge removes its local identifiers and access.
- Attempt to close the tenant-specific Twilio subaccount and dedicated resources. Never touch the shared trial-pool resources.
- Provider cleanup failures must not resurrect or block deletion of the local Forge account. Failures are logged for operational follow-up without retaining the deleted user's profile data.

## Session invalidation

Forge uses stateless HMAC cookies. The current fast path trusts the staff and company identifiers embedded in an otherwise valid cookie, which would let a deleted employee retain a structurally valid session on another device.

Session resolution will therefore verify that:

- the referenced staff row still exists in the referenced company, and
- the company still exists and is active.

A deleted staff row or company invalidates all of its outstanding cookies on their next request. The built-in platform-admin path remains separate.

Because this changes authentication/session behavior, repository policy requires explicit approval before the implementation branch is merged.

## Existing employee-removal endpoint

The administrative staff-deletion endpoint must not bypass the new invariants. It will:

- require the existing `team.manage` permission,
- refuse to remove the last administrator while other employees remain,
- refuse to remove the final employee and direct that person through the reauthenticated account-deletion flow,
- share count/check logic with self-deletion to avoid drift.

## Public deletion information

The public data-deletion page will no longer instruct ordinary users to email support as the only option. It will direct signed-in users to Settings > Profile > Delete account and accurately summarize the employee-only and last-employee organization-deletion outcomes. Support remains available for users who cannot access their account, not as a required step for deletion.

## Verification

Automated coverage will exercise the deletion service with an isolated database fixture:

1. Employee-only deletion preserves the organization and its CRM data.
2. Deleting the last administrator is blocked while non-admin employees remain.
3. Promoting another administrator allows the original administrator to delete their account.
4. Last-employee deletion removes the company and all populated tenant data.
5. A team-count change during confirmation returns a conflict rather than performing the wrong scope.
6. Incorrect passwords and the built-in platform account cannot delete.
7. Old cookies for deleted staff and companies no longer resolve to sessions.
8. The administrative employee-removal endpoint cannot bypass the safeguards.

Manual verification will cover:

- Google Sign-In visible and functional in a normal browser.
- Google Sign-In absent from first paint onward in iOS and Android Capacitor shells.
- Native-marked requests cannot start Google OAuth.
- Responsive deletion dialogs and keyboard handling on a physical iPhone/iPad.
- The complete Apple recording flow: create a fresh one-person organization, navigate to Settings > Profile, delete the account and organization, confirm the return to Login.

## App Review response

The resubmission notes will explain:

- The iOS app exclusively offers Forge's first-party email/password authentication. Google Sign-In is available only on the website and cannot be initiated from the native app.
- Account deletion is available at Settings > Profile > Delete account.
- A physical-device recording demonstrates account creation/sign-in, navigation to deletion, confirmation, organization deletion for the last employee, and return to Login.
