import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleDatabase, loadLifecycleRoute } from "./helpers/lifecycle-harness.mjs";
import { setStatusStep } from "../src/lib/job-status-transitions.ts";
import { NextRequest } from "next/server.js";

test("lifecycle time zone formats Chicago and New York tenants and defaults legacy Eastern", async t => {
  for (const [zone, expected] of [["America/Chicago","10:00 AM"],["America/New_York","11:00 AM"],[null,"11:00 AM"]]) {
    const { db, close } = lifecycleDatabase(); t.after(close);
    if (zone) await db.prepare("UPDATE company SET time_zone=? WHERE id=1").run(zone);
    await db.prepare("INSERT INTO customization_settings VALUES (1,?)").run(JSON.stringify({ messages: { drive_start: { enabled: true, template: "Arriving {job_start}" } } }));
    await setStatusStep(db, 12, "en_route", 1);
    const row = await db.prepare("SELECT body FROM job_lifecycle_notifications").get();
    assert.ok(row?.body.includes(expected), `${zone}: ${row?.body}`);
  }
});

test("company time zone settings reject malformed input with 400 and preserve omitted values", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  const route = await loadLifecycleRoute("settings/company");
  const put = (body: object) => route.PUT(new Request("https://example.com/api/settings/company", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  for (const value of ["", " ", " America/Chicago", "America/Chicago ", "Not/AZone", null, 123]) {
    assert.equal((await put({ time_zone: value })).status, 400, String(value));
  }
  assert.equal((await put({ time_zone: "America/Chicago" })).status, 200);
  await put({ name: "Renamed" });
  assert.equal((await (await route.GET()).json()).time_zone, "America/Chicago");
  assert.equal((await db.prepare("SELECT time_zone FROM company WHERE id=2").get())?.time_zone, "America/New_York");
});

test("lifecycle outbox cron requires the configured secret and fails closed when missing", async t => {
  const { db, close } = lifecycleDatabase(); t.after(close);
  const oldSecret = process.env.CRON_SECRET;
  t.after(() => { if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret; });
  const route = await loadLifecycleRoute("cron/job-lifecycle-notifications");
  await setStatusStep(db, 12, "en_route", 1);
  process.env.CRON_SECRET = "cron-test";
  assert.equal((await route.GET(new Request("https://example.com/cron"))).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await route.GET(new Request("https://example.com/cron"))).status, 401);
  process.env.CRON_SECRET = "cron-test";
  const response = await route.GET(new Request("https://example.com/cron", { headers: { authorization: "Bearer cron-test" } }));
  assert.equal(response.status, 200); assert.equal((await response.json()).sent, 1);
});

test("lifecycle outbox cron reaches secret authentication through middleware without a session cookie", async () => {
  const { middleware } = await loadLifecycleRoute("middleware");
  for (const method of ["GET", "POST"]) {
    const response = await middleware(new NextRequest("https://example.com/api/cron/job-lifecycle-notifications", { method, headers: { authorization: "Bearer cron-test" } }));
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
  for (const path of ["/api/jobs/12/status", "/api/cron/job-lifecycle-notifications/other"]) {
    assert.equal((await middleware(new NextRequest(`https://example.com${path}`, { headers: { authorization: "Bearer cron-test" } }))).status, 401);
  }
});
