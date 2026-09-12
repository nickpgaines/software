import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleDatabase } from "./helpers/lifecycle-harness.mjs";
import { setStatusStep } from "../src/lib/job-status-transitions.ts";

test("lifecycle transition changes a timestamp once and keeps one notification through clear/reapply", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  assert.equal(await setStatusStep(db, 12, "en_route", 1), true);
  assert.equal(await setStatusStep(db, 12, "en_route", 1), false);
  assert.equal(await setStatusStep(db, 12, "en_route", 1, true), true);
  assert.equal((await db.prepare("SELECT en_route_at FROM jobs WHERE id=12").get())?.en_route_at, null);
  assert.equal(await setStatusStep(db, 12, "en_route", 1, true), false);
  assert.equal(await setStatusStep(db, 12, "en_route", 1), true);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM job_lifecycle_notifications").get())?.count, 1);
});

test("lifecycle transition cannot mutate or enqueue another tenant's job", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  assert.equal(await setStatusStep(db, 12, "completed", 2), false);
  assert.equal(await setStatusStep(db, 999, "completed", 1), false);
  assert.equal((await db.prepare("SELECT completed_at FROM jobs WHERE id=12").get())?.completed_at, null);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM job_lifecycle_notifications").get())?.count, 0);
});
