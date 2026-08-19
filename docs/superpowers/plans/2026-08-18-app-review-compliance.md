# App Review Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Google Sign-In on the website while removing it from Capacitor apps, and add secure in-app account deletion that deletes a tenant when its last employee leaves.

**Architecture:** A small pure policy module decides whether an employee deletion is individual, organization-wide, or blocked by the final-admin safeguard. The API routes use that policy while re-reading counts in a libSQL transaction; session resolution validates the persisted staff and company rows so deleted identities cannot reuse an HMAC cookie. Native detection remains client-side, fail-closed for login UI, and sets a non-privileged cookie that prevents the Google OAuth start route from being entered in a Capacitor shell.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, libSQL/Turso, Capacitor 8, Node 24 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-18-app-review-auth-account-deletion-design.md`

## Global Constraints

- Google Sign-In remains available to normal browser sessions and is absent from the first native-app render.
- Do not add Sign in with Apple or an ownership model.
- Require the current password for every self-deletion; require typed `DELETE` for last-employee organization deletion.
- A final administrator may not leave while other employees remain.
- A final employee may only remove the organization through the reauthenticated self-deletion endpoint.
- Deletion must invalidate existing sessions for removed staff and deleted companies.
- Preserve the existing untracked workspace files and commit only task files.
- Build with `/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`; the shell-default Node 16 is unsupported by Next.js 14.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/lib/account-deletion-policy.ts` | Pure, tested decisions for self-deletion and administrative employee removal. |
| `apps/web/tests/account-deletion-policy.test.ts` | Node test coverage for all employee/admin count combinations. |
| `apps/web/src/lib/native-auth.ts` | Native-app cookie name and pure Google OAuth eligibility check. |
| `apps/web/tests/native-auth.test.ts` | Node test coverage for native marker behavior. |
| `apps/web/src/app/api/account/deletion/route.ts` | Authenticated deletion preview and reauthenticated transaction. |
| `apps/web/src/lib/auth.ts` | Persistent staff/company validation for HMAC-backed sessions. |
| `apps/web/src/app/api/staff/[id]/route.ts` | Permissioned administrative removal that cannot bypass deletion safeguards. |
| `apps/web/src/components/NativeChrome.tsx` | Sets the native-app marker inside Capacitor. |
| `apps/web/src/app/login/page.tsx` | Shows Google only after confirming a normal browser environment. |
| `apps/web/src/app/api/auth/google/start/route.ts` | Rejects Google OAuth starts from a marked native app. |
| `apps/web/src/components/SettingsTabs.tsx` | Profile danger zone and responsive deletion confirmation dialog. |
| `apps/web/src/app/data-deletion/page.tsx` | Directs signed-in business users to the in-app deletion flow. |
| `apps/web/package.json` | Adds the Node built-in test command. |

### Task 1: Establish the test command and deletion policy

**Files:**
- Create: `apps/web/src/lib/account-deletion-policy.ts`
- Create: `apps/web/tests/account-deletion-policy.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `decideSelfDeletion(input: { employeeCount: number; adminCount: number; actorIsAdmin: boolean }): AccountDeletionDecision`.
- Produces: `getAdministrativeRemovalBlock(input: { employeeCount: number; adminCount: number; targetIsAdmin: boolean }): "final_employee" | "final_admin" | null`.
- Consumes: no production dependencies, so Node tests import the actual TypeScript source directly.

- [x] **Step 1: Add the Node test command and write the failing policy tests**

Add this script to `apps/web/package.json`:

```json
"test": "node --no-warnings --experimental-strip-types --test tests/*.test.ts"
```

Create tests that assert the exact contract:

```ts
assert.deepEqual(decideSelfDeletion({ employeeCount: 1, adminCount: 1, actorIsAdmin: true }), {
  kind: "organization",
});
assert.deepEqual(decideSelfDeletion({ employeeCount: 2, adminCount: 1, actorIsAdmin: true }), {
  kind: "blocked",
  reason: "final_admin",
});
assert.deepEqual(decideSelfDeletion({ employeeCount: 2, adminCount: 1, actorIsAdmin: false }), {
  kind: "employee",
});
assert.equal(getAdministrativeRemovalBlock({ employeeCount: 1, adminCount: 1, targetIsAdmin: true }), "final_employee");
```

- [x] **Step 2: Run the test to verify it fails because the module does not exist**

Run:

```bash
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/account-deletion-policy.test.ts
```

Expected: module-not-found failure for `account-deletion-policy.ts`.

- [x] **Step 3: Implement the minimal pure policy module**

Define:

```ts
export type AccountDeletionDecision =
  | { kind: "employee" }
  | { kind: "organization" }
  | { kind: "blocked"; reason: "final_admin" };
```

Return `organization` when `employeeCount === 1`, return `blocked/final_admin` only when the actor is an administrator, at least one other employee remains, and `adminCount === 1`; otherwise return `employee`. Throw `RangeError` for impossible counts (`employeeCount < 1`, `adminCount < 0`, or `adminCount > employeeCount`).

For administrative removal, return `final_employee` when `employeeCount === 1`, `final_admin` when the target is the only administrator, and `null` otherwise.

- [x] **Step 4: Run the policy tests and TypeScript build**

Run:

```bash
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/account-deletion-policy.test.ts
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node apps/web/node_modules/next/dist/bin/next build
```

Expected: all policy cases pass and the existing app builds.

- [x] **Step 5: Commit the policy test cycle**

```bash
git add apps/web/package.json apps/web/src/lib/account-deletion-policy.ts apps/web/tests/account-deletion-policy.test.ts
git commit -m "test: cover account deletion policy"
```

### Task 2: Keep Google Sign-In web-only

**Files:**
- Create: `apps/web/src/lib/native-auth.ts`
- Create: `apps/web/tests/native-auth.test.ts`
- Modify: `apps/web/src/components/NativeChrome.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/api/auth/google/start/route.ts`

**Interfaces:**
- Consumes: `isNativeApp()` from `src/lib/native.ts`.
- Produces: `NATIVE_APP_COOKIE`, `isNativeAppMarker(value)`, and `canStartGoogleOAuth(value)` from `src/lib/native-auth.ts`.
- Produces: native cookie set by `NativeChrome`; later requests carry it into the Google OAuth route.

- [x] **Step 1: Write failing native-auth tests**

Assert that only the exact marker value `"1"` is native and that native marker values deny Google OAuth:

```ts
assert.equal(isNativeAppMarker("1"), true);
assert.equal(isNativeAppMarker(undefined), false);
assert.equal(canStartGoogleOAuth("1"), false);
assert.equal(canStartGoogleOAuth(undefined), true);
```

- [x] **Step 2: Run the test to verify it fails because the module does not exist**

Run:

```bash
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/native-auth.test.ts
```

Expected: module-not-found failure for `native-auth.ts`.

- [x] **Step 3: Implement native marker policy and wire the app surfaces**

Create `native-auth.ts` with:

```ts
export const NATIVE_APP_COOKIE = "forge_native_app";
export const isNativeAppMarker = (value: string | undefined) => value === "1";
export const canStartGoogleOAuth = (value: string | undefined) => !isNativeAppMarker(value);
```

In `NativeChrome`, after `isNativeApp()` succeeds, set this cookie with `Path=/`, `SameSite=Lax`, a 30-day `Max-Age`, and `Secure` only on HTTPS pages. In Login, initialize the Google section as hidden and reveal it only after an effect confirms `!isNativeApp()`. In Google OAuth start, read the marker cookie and redirect native requests to `/login` without contacting Google.

- [x] **Step 4: Run focused tests and build**

Run:

```bash
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/native-auth.test.ts
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
```

Expected: native policy tests pass and the web build succeeds.

- [x] **Step 5: Commit the web-only Google implementation**

```bash
git add apps/web/src/lib/native-auth.ts apps/web/tests/native-auth.test.ts apps/web/src/components/NativeChrome.tsx apps/web/src/app/login/page.tsx apps/web/src/app/api/auth/google/start/route.ts
git commit -m "fix: hide Google login in native apps"
```

### Task 3: Add the reauthenticated self-deletion API

**Files:**
- Create: `apps/web/src/app/api/account/deletion/route.ts`
- Modify: `apps/web/src/lib/auth.ts`

**Interfaces:**
- Consumes: `decideSelfDeletion()` from `account-deletion-policy.ts`, `getSessionContext()`, `getDb()`, `syncReplica()`, `verifyPassword()`, `SESSION_COOKIE`.
- Produces: `GET /api/account/deletion` preview `{ scope, companyName, employeeCount, adminCount, blockedReason }`.
- Produces: `DELETE /api/account/deletion` response `{ ok: true, scope: "employee" | "organization" }`.

- [x] **Step 1: Extend the failing policy tests with invalid-count cases**

Add tests proving impossible counts throw:

```ts
assert.throws(() => decideSelfDeletion({ employeeCount: 0, adminCount: 0, actorIsAdmin: false }), RangeError);
assert.throws(() => decideSelfDeletion({ employeeCount: 2, adminCount: 3, actorIsAdmin: true }), RangeError);
```

- [x] **Step 2: Run tests and verify the new cases fail**

Run the Task 1 focused test command. Expected: failures because the current policy accepts invalid counts.

- [x] **Step 3: Build the route around a single transaction**

`GET` must fetch the current staff, company, `COUNT(*)` employees, and `COUNT(*)` administrators for the session's company, then derive the response from `decideSelfDeletion()`.

`DELETE` must parse `{ password, confirmation }`, reject a missing staff identity or wrong password, and run the same reads inside `db.transaction`. It must require `confirmation === "DELETE"` for organization deletion, delete the current `staff` row for employee scope, and delete the `company` row for organization scope. After commit, call `syncReplica()` and clear `SESSION_COOKIE` with `maxAge: 0`.

Before deleting an organization, read its `stripe_account_id`, `stripe_account_type`, and `twilio_subaccount_sid`; best-effort deauthorize Standard Stripe Connect accounts and close only the tenant Twilio subaccount. Log external cleanup failures but never roll back a successful local deletion.

Update `getSessionContext()` so v2 HMAC cookies verify the persisted `(staff.id, staff.company_id, company.access_status)` row before returning a staff session. Treat a missing staff/company row or non-`active` company as no session. Keep the environment platform-admin branch unchanged.

- [ ] **Step 4: Run focused tests, type checking, and a manual route smoke test**

Run the full Node test command and production build. Then use a disposable local database/session to verify these response paths: employee preview, final-admin 409, organization confirmation required, wrong password 401, and post-delete session rejection.

- [x] **Step 5: Commit the deletion API and session invalidation**

```bash
git add apps/web/src/app/api/account/deletion/route.ts apps/web/src/lib/auth.ts apps/web/src/lib/account-deletion-policy.ts apps/web/tests/account-deletion-policy.test.ts
git commit -m "feat: add secure account deletion"
```

### Task 4: Prevent administrative employee removal from bypassing safeguards

**Files:**
- Modify: `apps/web/src/app/api/staff/[id]/route.ts`
- Modify: `apps/web/tests/account-deletion-policy.test.ts`

**Interfaces:**
- Consumes: `getAdministrativeRemovalBlock()` and `getSessionContext()`.
- Consumes: `buildMe()` to require `team.manage`.
- Produces: staff-delete `403` for callers without `team.manage`; `409` with `final_admin` or `final_employee` when removal is unsafe.

- [x] **Step 1: Write the failing final-admin removal test**

Add a policy test that proves removing one of several employees is still blocked when that target is the sole administrator:

```ts
assert.equal(
  getAdministrativeRemovalBlock({ employeeCount: 3, adminCount: 1, targetIsAdmin: true }),
  "final_admin"
);
```

- [x] **Step 2: Run the focused test and verify it fails before implementation**

Run the account-deletion policy test. Expected: failure until `getAdministrativeRemovalBlock()` handles the target-admin case.

- [x] **Step 3: Replace unguarded staff deletion**

Resolve a full session context, build the caller permissions, and reject callers without `team.manage`. Fetch the target staff row in the caller's company, calculate employee/admin counts, and apply `getAdministrativeRemovalBlock()`. Return `409` for a final employee with copy directing self-deletion through Settings > Profile, and `409` for a final administrator with copy directing the caller to promote another administrator. Only issue `DELETE FROM staff` after all checks pass.

- [x] **Step 4: Run all policy tests and build**

Run:

```bash
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/*.test.ts
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
```

Expected: every policy case passes and no route type errors are introduced.

- [x] **Step 5: Commit the protected administrative removal route**

```bash
git add apps/web/src/app/api/staff/[id]/route.ts apps/web/tests/account-deletion-policy.test.ts
git commit -m "fix: protect final admin and employee removal"
```

### Task 5: Add the Profile deletion experience and public guidance

**Files:**
- Modify: `apps/web/src/components/SettingsTabs.tsx`
- Modify: `apps/web/src/app/data-deletion/page.tsx`

**Interfaces:**
- Consumes: `GET` and `DELETE /api/account/deletion`.
- Produces: profile danger zone that reveals server-derived scope before confirmation and returns to Login after success.

- [x] **Step 1: Write the failing UI acceptance checklist**

Record these acceptance checks before editing UI:

```text
Profile shows Delete account for a staff account, never for the environment admin.
Employee-only dialog names the employee-only result and accepts a password.
Final-admin dialog blocks deletion and links to /employees.
Last-employee dialog names the organization, requires password plus DELETE, and reaches /login after success.
```

- [x] **Step 2: Verify the current Profile panel cannot meet the checklist**

Run the app locally and inspect Settings > Profile. Expected: no deletion danger zone or confirmation flow exists.

- [x] **Step 3: Implement the dialog with existing primitives**

Create a focused `AccountDeletionSection` inside `SettingsTabs.tsx` using `Dialog`, `Button`, `Input`, and `Label`. Fetch preview only when opened; display API errors inline; disable final-admin submission; require password for enabled scopes and the exact uppercase `DELETE` input for organization scope. Clear form state on close. On success, call `router.replace("/login?deleted=1")` and `router.refresh()`.

Update the public data-deletion page so business account holders are told to sign in and use Settings > Profile > Delete account; retain email support for inaccessible accounts and third-party/consumer data requests.

- [ ] **Step 4: Manually verify web and native responsive behavior**

Verify in a desktop browser and a Capacitor simulator/device that the dialog is keyboard-accessible, has no horizontal overflow, leaves bottom controls above the safe area, and presents all three server states. Verify Google is visible in a browser and absent from the Capacitor login page.

- [x] **Step 5: Commit the UI and deletion instructions**

```bash
git add apps/web/src/components/SettingsTabs.tsx apps/web/src/app/data-deletion/page.tsx
git commit -m "feat: add account deletion settings flow"
```

### Task 6: Final compliance verification and review handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-08-18-app-review-compliance.md` to check completed items.

**Interfaces:**
- Consumes: all implementation tasks and the approved design spec.
- Produces: reproducible validation evidence and App Review recording instructions.

- [x] **Step 1: Run automated tests and full production build**

Run:

```bash
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/*.test.ts
cd apps/web && /Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
```

Expected: all tests pass and Next completes compilation, type checking, static generation, and trace collection.

- [x] **Step 2: Run the App Store compliance scan**

Run:

```bash
greenlight preflight .
```

Expected: the app-specific social-login and account-deletion findings are absent. Record unrelated critical findings separately rather than silently expanding this feature.

- [ ] **Step 3: Record the physical-device App Review flow**

Use a fresh one-person organization and capture: signup or sign-in; Settings > Profile; Delete account; password and `DELETE` confirmation; return to Login. Add the recording to App Review Information notes and explain that iOS offers first-party email/password login only.

- [ ] **Step 4: Verify diff scope and commit final documentation state**

Run `git diff --check`, inspect `git status --short`, stage only files listed in this plan, and commit the checked plan if changed:

```bash
git add docs/superpowers/plans/2026-08-18-app-review-compliance.md
git commit -m "docs: complete app review compliance plan"
```

## Plan Self-Review

| Design requirement | Plan task |
| --- | --- |
| Web-only Google Sign-In with no native flash | Task 2 |
| No Sign in with Apple or ownership model | Global Constraints, Tasks 2–5 |
| Count-based employee/organization deletion | Tasks 1 and 3 |
| Final-admin safeguard | Tasks 1, 3, and 4 |
| HMAC session invalidation | Task 3 |
| Existing staff endpoint cannot bypass rules | Task 4 |
| Profile UI and public deletion guidance | Task 5 |
| Physical-device recording and compliance preflight | Task 6 |

The plan uses the same exported names in every task, includes exact test commands, and has no unassigned requirements.
