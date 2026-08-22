import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CUSTOMIZATIONS } from "../src/lib/customizations.ts";
import {
  buildJobLifecycleMessage,
  messageKeyForStep,
  notificationWarning,
  shouldNotifyForTransition,
} from "../src/lib/job-lifecycle-notifications.ts";

test("maps job steps to their customization blocks", () => {
  assert.equal(messageKeyForStep("en_route"), "drive_start");
  assert.equal(messageKeyForStep("arrived"), "drive_end");
  assert.equal(messageKeyForStep("started"), "job_started");
  assert.equal(messageKeyForStep("completed"), "job_finish");
});

test("notifies only for a changed non-clear transition", () => {
  assert.equal(
    shouldNotifyForTransition({ clear: false, changed: true }),
    true
  );
  assert.equal(
    shouldNotifyForTransition({ clear: true, changed: true }),
    false
  );
  assert.equal(
    shouldNotifyForTransition({ clear: false, changed: false }),
    false
  );
});

test("renders variables, personalized header, total, and technician", () => {
  const messages = structuredClone(DEFAULT_CUSTOMIZATIONS.messages);
  messages.drive_start = {
    ...messages.drive_start,
    template:
      "{company_name}: {job_start}, {job_total}. Customer: {customer_first_name} {customer_last_name}.",
    include_personalized_header: true,
    include_driver_name_image: true,
  };

  const result = buildJobLifecycleMessage({
    step: "en_route",
    messages,
    customerName: "Nicholas Gaines",
    companyName: "Summit Window Cleaning",
    scheduledAt: "2026-08-24T15:00:00.000Z",
    totalCents: 24900,
    technicianName: "David Beazley",
    locale: "en-US",
    timeZone: "America/New_York",
  });

  assert.match(result!.body, /^Hi Nicholas,/);
  assert.match(result!.body, /Summit Window Cleaning/);
  assert.match(result!.body, /August 24, 2026 at 11:00 AM/);
  assert.match(result!.body, /\$249\.00/);
  assert.match(result!.body, /Nicholas Gaines/);
  assert.match(result!.body, /David Beazley/);
  assert.doesNotMatch(result!.body, /\{[a-z_]+\}/);
});

test("returns null for disabled or empty message blocks", () => {
  assert.equal(
    buildJobLifecycleMessage({
      step: "started",
      messages: DEFAULT_CUSTOMIZATIONS.messages,
      customerName: "Nicholas Gaines",
      companyName: "Summit Window Cleaning",
      scheduledAt: "2026-08-24T15:00:00.000Z",
      totalCents: 24900,
      technicianName: null,
      locale: "en-US",
      timeZone: "America/New_York",
    }),
    null
  );

  const messages = structuredClone(DEFAULT_CUSTOMIZATIONS.messages);
  messages.drive_end.template = "   ";
  assert.equal(
    buildJobLifecycleMessage({
      step: "arrived",
      messages,
      customerName: "Nicholas Gaines",
      companyName: "Summit Window Cleaning",
      scheduledAt: "2026-08-24T15:00:00.000Z",
      totalCents: 24900,
      technicianName: null,
      locale: "en-US",
      timeZone: "America/New_York",
    }),
    null
  );
});

test("warns only when an attempted lifecycle text fails", () => {
  assert.equal(notificationWarning(null), null);
  assert.equal(
    notificationWarning({ attempted: true, ok: true, error: null }),
    null
  );
  assert.equal(
    notificationWarning({
      attempted: true,
      ok: false,
      error: "Customer has no valid phone number.",
    }),
    "Job status updated, but the customer text was not delivered: Customer has no valid phone number."
  );
});
