# Job Lifecycle SMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send and log configured customer SMS messages when a job first enters En Route, Arrived, Started, or Completed, without rolling back the job status when delivery fails.

**Architecture:** Put lifecycle mapping and template rendering in a pure module. Make the job timestamp update atomic, then claim a durable, unique notification record before the status route loads tenant customizations and calls the existing logged SMS path. The claim survives status clears, so a lifecycle step cannot send twice.

**Tech Stack:** Next.js 14 route handlers, TypeScript, libSQL, Twilio through `sendAndLogCompanySms`, React 18, Node test runner.

**Spec:** Behavior Contract below, approved in conversation on 2026-08-22 (bounded change; no separate spec document).

## Global Constraints

- Preserve tenant scoping on every query.
- A status update succeeds even if notification delivery fails.
- Clearing, repeating, or clearing and later reapplying a status never sends the same lifecycle notification twice.
- Drive Start, Drive End, and Job Finish remain backward-compatible.
- Job Started is added disabled by default.
- Delivery uses `sendAndLogCompanySms` so success and failure appear in the conversation.
- Do not modify reminders, invoices, review requests, or Twilio registration.

## Behavior Contract

| Step | Block | Default |
|---|---|---|
| `en_route` | `drive_start` | Enabled |
| `arrived` | `drive_end` | Enabled |
| `started` | `job_started` | Disabled |
| `completed` | `job_finish` | Enabled |

Supported variables are `{customer_first_name}`, `{customer_last_name}`, `{company_name}`, `{job_start}`, and `{job_total}`. A personalized header prefixes `Hi {customer_first_name},`. The Drive Start driver option adds the assigned technician's name; photo/MMS support is outside this text-delivery repair.

---

### Task 1: Add the backward-compatible Job Started setting

**Files:**
- Modify: `apps/web/src/lib/customizations.ts`
- Modify: `apps/web/src/components/settings/CustomizationsPanel.tsx`
- Create: `apps/web/tests/job-lifecycle-customizations.test.ts`

**Interfaces:**
- Consumes: `MessageBlock`, `MessagesConfig`, `DEFAULT_CUSTOMIZATIONS`, `mergeCustomizations`.
- Produces: `MessagesConfig.job_started` and an editor between Drive End and Job Finish.

- [ ] **Step 1: Write the failing legacy-config test**

```ts
test("adds a disabled Job Started block to legacy config", () => {
  const merged = mergeCustomizations({
    messages: { drive_start: { ...DEFAULT_CUSTOMIZATIONS.messages.drive_start, template: "On our way" } } as never,
  });
  assert.equal(merged.messages.drive_start.template, "On our way");
  assert.deepEqual(merged.messages.job_started, {
    enabled: false,
    template: "Your technician has started the job.",
    include_personalized_header: false,
    include_driver_name_image: false,
  });
});
```

- [ ] **Step 2: Run it and verify the missing-property failure**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/job-lifecycle-customizations.test.ts
```

- [ ] **Step 3: Add the type, disabled default, merge fallback, and editor**

```ts
job_started: {
  ...EMPTY_BLOCK,
  enabled: false,
  template: "Your technician has started the job.",
}
```

```tsx
<MessageBlockEditor
  title="Job Started"
  block={config.job_started}
  onChange={(block) => set("job_started", block)}
/>
```

- [ ] **Step 4: Run focused and full tests**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/job-lifecycle-customizations.test.ts
npm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/customizations.ts apps/web/src/components/settings/CustomizationsPanel.tsx apps/web/tests/job-lifecycle-customizations.test.ts
git commit -m "feat: add optional job started message"
```

### Task 2: Define lifecycle policy and rendering

**Files:**
- Create: `apps/web/src/lib/job-lifecycle-notifications.ts`
- Create: `apps/web/tests/job-lifecycle-notifications.test.ts`

**Interfaces:**
- Produces: `JobLifecycleStep`, `messageKeyForStep`, `shouldNotifyForTransition`, `buildJobLifecycleMessage`, and `notificationWarning`.

- [ ] **Step 1: Write failing policy tests**

```ts
test("maps each step", () => {
  assert.equal(messageKeyForStep("en_route"), "drive_start");
  assert.equal(messageKeyForStep("arrived"), "drive_end");
  assert.equal(messageKeyForStep("started"), "job_started");
  assert.equal(messageKeyForStep("completed"), "job_finish");
});

test("only first non-clear transitions notify", () => {
  assert.equal(shouldNotifyForTransition({ clear: false, changed: true }), true);
  assert.equal(shouldNotifyForTransition({ clear: true, changed: true }), false);
  assert.equal(shouldNotifyForTransition({ clear: false, changed: false }), false);
});

test("renders variables, header, total, and technician", () => {
  const messages = structuredClone(DEFAULT_CUSTOMIZATIONS.messages);
  messages.drive_start = {
    ...messages.drive_start,
    template: "{company_name}: {job_start}, {job_total}",
    include_personalized_header: true,
    include_driver_name_image: true,
  };
  const result = buildJobLifecycleMessage({
    step: "en_route", messages,
    customerName: "Nicholas Gaines", companyName: "Summit Window Cleaning",
    scheduledAt: "2026-08-24T15:00:00.000Z", totalCents: 24900,
    technicianName: "David Beazley", locale: "en-US", timeZone: "America/New_York",
  });
  assert.match(result!.body, /^Hi Nicholas,/);
  assert.match(result!.body, /Summit Window Cleaning/);
  assert.match(result!.body, /\$249\.00/);
  assert.match(result!.body, /David Beazley/);
});

test("disabled blocks return null", () => {
  const result = buildJobLifecycleMessage({
    step: "started", messages: DEFAULT_CUSTOMIZATIONS.messages,
    customerName: "Nicholas Gaines", companyName: "Summit Window Cleaning",
    scheduledAt: "2026-08-24T15:00:00.000Z", totalCents: 24900,
    technicianName: null, locale: "en-US", timeZone: "America/New_York",
  });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run and verify module-not-found failure**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/job-lifecycle-notifications.test.ts
```

- [ ] **Step 3: Implement the pure API**

```ts
export type JobLifecycleStep = "en_route" | "arrived" | "started" | "completed";
const MESSAGE_KEY_BY_STEP = {
  en_route: "drive_start", arrived: "drive_end",
  started: "job_started", completed: "job_finish",
} as const;

export function messageKeyForStep(step: JobLifecycleStep) {
  return MESSAGE_KEY_BY_STEP[step];
}
export function shouldNotifyForTransition(input: { clear: boolean; changed: boolean }) {
  return !input.clear && input.changed;
}
```

Implement `buildJobLifecycleMessage` with `Intl.DateTimeFormat`, `Intl.NumberFormat`, complete token replacement, optional header/technician text, empty-template suppression, and disabled-block suppression. Implement `notificationWarning` to return a warning only for an attempted failed send.

- [ ] **Step 4: Run focused and full tests, then commit**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/job-lifecycle-notifications.test.ts
npm test
git add apps/web/src/lib/job-lifecycle-notifications.ts apps/web/tests/job-lifecycle-notifications.test.ts
git commit -m "feat: define job lifecycle notifications"
```

### Task 3: Make transitions and notification claims idempotent

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Modify: `apps/web/src/lib/jobs.ts:544`
- Create: `apps/web/src/lib/customization-store.ts`
- Modify: `apps/web/src/app/api/settings/customizations/route.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/review-request/route.ts`
- Modify: `apps/web/src/app/api/jobs/[id]/status/route.ts`
- Create: `apps/web/tests/job-status-transition.test.ts`

**Interfaces:**
- Produces: `setStatusStep(...): Promise<boolean>`, `claimJobLifecycleNotification(...)`, shared `loadCustomizations(db, companyId)`, and `status_notification` response metadata.

- [ ] **Step 1: Write the failing conditional-update test**

```ts
test("reports only the first status transition as changed", async () => {
  assert.equal(await setStatusStep(fakeDb(1), 7, "en_route", 3, false), true);
  assert.equal(await setStatusStep(fakeDb(0), 7, "en_route", 3, false), false);
  assert.match(recordedSql[0], /en_route_at IS NULL/);
});

test("claims a lifecycle notification once even after a status clear", async () => {
  assert.equal(await claimJobLifecycleNotification(fakeDb(1), 3, 7, "en_route"), true);
  assert.equal(await claimJobLifecycleNotification(fakeDb(0), 3, 7, "en_route"), false);
  assert.match(recordedSql[0], /ON CONFLICT\s*\(job_id, step\)\s*DO NOTHING/i);
});
```

- [ ] **Step 2: Run and verify the current void result fails**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/job-status-transition.test.ts
```

- [ ] **Step 3: Make `setStatusStep` conditional and return `changes > 0`**

```ts
const result = clear
  ? await db.prepare(`UPDATE jobs SET ${col} = NULL, status = 'scheduled'
       WHERE id = ? AND company_id = ? AND ${col} IS NOT NULL`).run(id, companyId)
  : await db.prepare(`UPDATE jobs SET ${col} = ?, status = ?
       WHERE id = ? AND company_id = ? AND ${col} IS NULL`)
      .run(new Date().toISOString(), step, id, companyId);
return result.changes > 0;
```

- [ ] **Step 4: Add a durable notification ledger and atomic claim**

```sql
CREATE TABLE IF NOT EXISTS job_lifecycle_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('en_route', 'arrived', 'started', 'completed')),
  outcome TEXT NOT NULL DEFAULT 'claimed',
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(job_id, step)
);
CREATE INDEX IF NOT EXISTS idx_job_lifecycle_notifications_company_job
  ON job_lifecycle_notifications(company_id, job_id);
```

Implement `claimJobLifecycleNotification` as `INSERT ... ON CONFLICT(job_id, step) DO NOTHING` and return `changes > 0`. Keep the `company_id` predicate when recording the final outcome. The unique claim is created for every first non-clear transition, including disabled or empty templates, so enabling a template later cannot retroactively send or cause a clear/reapply duplicate.

- [ ] **Step 5: Extract and reuse customization loading**

```ts
export async function loadCustomizations(
  db: Pick<Db, "prepare">,
  companyId: number
): Promise<CustomizationConfig>;
```

Move the default/malformed-JSON behavior from the settings route into this function and reuse it in settings, review requests, and status notifications.

- [ ] **Step 6: Dispatch only after winning the durable claim**

```ts
const changed = await setStatusStep(db, id, step, companyId, !!clear);
const detail = await getJobDetail(db, id, companyId);
let statusNotification = null;
const claimed = detail && shouldNotifyForTransition({ clear: !!clear, changed })
  ? await claimJobLifecycleNotification(db, companyId, id, step)
  : false;
if (detail && claimed) {
  const config = await loadCustomizations(db, companyId);
  const company = await db.prepare("SELECT name FROM company WHERE id = ? LIMIT 1")
    .get<{ name: string | null }>(companyId);
  const message = buildJobLifecycleMessage({
    step, messages: config.messages, customerName: detail.customer_name,
    companyName: company?.name || "Forge service provider",
    scheduledAt: detail.scheduled_at, totalCents: detail.price_cents,
    technicianName: detail.techs[0]?.name || null,
    locale: "en-US", timeZone: "America/New_York",
  });
  if (message) statusNotification = {
    attempted: true,
    ...(await sendAndLogCompanySms({ companyId, customerId: detail.customer_id, body: message.body })),
  };
  await recordJobLifecycleNotificationOutcome(db, {
    companyId, jobId: id, step,
    outcome: !message ? "skipped" : statusNotification!.ok ? "sent" : "failed",
    messageId: statusNotification?.messageId ?? null,
    error: statusNotification?.error ?? null,
  });
}
return NextResponse.json({ ...detail, status_notification: statusNotification });
```

Gate existing activity logging on `changed`. Wrap notification customization/rendering/sending in its own `try/catch`: update the claimed row to `failed` and return a warning payload on any unexpected notification error, while preserving the successful job status response. Do not retry automatically because the provider result is not safely replayable.

- [ ] **Step 7: Run tests/build and commit**

```bash
npm test
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
git add apps/web/src/lib/db.ts apps/web/src/lib/jobs.ts apps/web/src/lib/customization-store.ts apps/web/src/app/api/settings/customizations/route.ts 'apps/web/src/app/api/jobs/[id]/review-request/route.ts' 'apps/web/src/app/api/jobs/[id]/status/route.ts' apps/web/tests/job-status-transition.test.ts
git commit -m "fix: send job lifecycle texts"
```

### Task 4: Show delivery failures and verify production behavior

**Files:**
- Modify: `apps/web/src/components/JobDetailClient.tsx:374`
- Modify: `apps/web/src/lib/job-lifecycle-notifications.ts`
- Test: `apps/web/tests/job-lifecycle-notifications.test.ts`

**Interfaces:**
- Consumes: `status_notification` from Task 3.
- Produces: Employee warning while retaining the updated job state.

- [ ] **Step 1: Add the failing warning test**

```ts
assert.equal(notificationWarning(null), null);
assert.equal(notificationWarning({ attempted: true, ok: true, error: null }), null);
assert.equal(
  notificationWarning({ attempted: true, ok: false, error: "Customer has no valid phone number." }),
  "Job status updated, but the customer text was not delivered: Customer has no valid phone number."
);
```

- [ ] **Step 2: Implement and display the warning**

```ts
export function notificationWarning(result: NotificationResult | null) {
  if (!result?.attempted || result.ok) return null;
  return `Job status updated, but the customer text was not delivered: ${result.error || "Unknown delivery error"}`;
}
```

Parse the enriched status response in `toggleStep`, update the job first, then call `alert(warning)` when non-null. If the route itself fails, parse its error response and alert it instead of silently doing nothing.

- [ ] **Step 3: Run complete verification**

```bash
npm test
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
git diff --check
```

- [ ] **Step 4: Commit, review, deploy, and smoke test**

```bash
git add apps/web/src/components/JobDetailClient.tsx apps/web/src/lib/job-lifecycle-notifications.ts apps/web/tests/job-lifecycle-notifications.test.ts
git commit -m "fix: surface lifecycle text failures"
```

After review and deployment, use a dedicated production test customer. Confirm En Route, Arrived, enabled Started, and Completed each create exactly one outbound message; disabled Started, clears, repeats, and clear/reapply sequences create no duplicate. Confirm a forced delivery failure remains logged and warns the employee without reverting the status. Record only job/message IDs and provider statuses—never phone numbers or credentials.
