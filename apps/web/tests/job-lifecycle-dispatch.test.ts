import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleDatabase } from "./helpers/lifecycle-harness.mjs";
import { dispatchJobLifecycleNotification } from "../src/lib/job-lifecycle-dispatch.ts";
import { setStatusStep } from "../src/lib/job-status-transitions.ts";

test("lifecycle consent permits a configured first lifecycle transition", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  const changed = await setStatusStep(db, 12, "en_route", 1);
  const sends: unknown[] = [];
  const result = await dispatchJobLifecycleNotification({ db, companyId: 1, jobId: 12, step: "en_route", changed, clear: false,
    send: async message => { sends.push(message); return { ok: true, messageId: 88, status: "queued", error: null }; },
  });
  assert.equal(result?.ok, true); assert.equal(result?.outcome, "sent");
  assert.equal(sends.length, 1);
  assert.equal((sends[0] as { customerId: number }).customerId, 90);
  assert.match((sends[0] as { body: string }).body, /on their way/);
  assert.equal((await db.prepare("SELECT message_id FROM job_lifecycle_notifications").get())?.message_id, 88);
});

test("lifecycle consent skips all steps for absent, declined, or another tenant/customer consent", async t => {
  for (const consent of [null, [1,90,0], [2,90,1], [1,91,1]]) {
    const { db, close } = lifecycleDatabase(); t.after(close);
    await db.exec("DELETE FROM estimates");
    if (consent) await db.prepare("INSERT INTO estimates VALUES (?,?,?)").run(...consent);
    let sends = 0;
    for (const step of ["en_route", "arrived", "started", "completed"] as const) {
      const changed = await setStatusStep(db, 12, step, 1);
      const result = await dispatchJobLifecycleNotification({ db, companyId: 1, jobId: 12, step, changed, clear: false,
        send: async () => { sends++; throw new Error("must not send"); },
      });
      assert.equal(result?.outcome, "skipped");
      assert.match(result?.error ?? "", /consent/);
    }
    assert.equal(sends, 0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM job_lifecycle_notifications WHERE outcome='skipped'").get())?.count, 4);
  }
});

test("lifecycle outbox does not send on clear, repeat, duplicate dispatch, or disabled block", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  let sends = 0;
  const input = { db, companyId: 1, jobId: 12, step: "en_route" as const, changed: true, clear: false,
    send: async () => { sends++; return { ok: true, messageId: 88, status: "queued", error: null }; },
  };
  await setStatusStep(db, 12, "en_route", 1);
  await dispatchJobLifecycleNotification(input);
  await dispatchJobLifecycleNotification(input);
  await setStatusStep(db, 12, "en_route", 1, true);
  assert.equal(await dispatchJobLifecycleNotification({ ...input, clear: true }), null);
  await setStatusStep(db, 12, "en_route", 1);
  await dispatchJobLifecycleNotification(input);
  assert.equal(await dispatchJobLifecycleNotification({ ...input, changed: false }), null);
  await setStatusStep(db, 12, "started", 1);
  assert.equal((await dispatchJobLifecycleNotification({ ...input, step: "started" }))?.outcome, "skipped");
  assert.equal(sends, 1);
});

test("lifecycle preparation failure returns a durable warning after status commits", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  await db.exec("DROP TABLE customization_settings");
  await setStatusStep(db, 12, "completed", 1);
  const result = await dispatchJobLifecycleNotification({ db, companyId: 1, jobId: 12, step: "completed", changed: true, clear: false,
    send: async () => { throw new Error("must not send"); },
  });
  assert.equal(result?.ok, false); assert.equal(result?.outcome, "failed");
  assert.match(result?.error ?? "", /customization_settings/);
  assert.ok((await db.prepare("SELECT completed_at FROM jobs WHERE id=12").get())?.completed_at);
});
