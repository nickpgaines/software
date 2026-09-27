import assert from "node:assert/strict";
// Node 24 exposes registerHooks; the repository's Node 20 type package does not yet declare it.
// @ts-expect-error Node 24 runtime API
import { registerHooks } from "node:module";
import test from "node:test";
import { lifecycleDatabase, sends } from "./helpers/lifecycle-harness.mjs";

let routeImport = 0;
async function loadOperatorRoute(path: string, session: null | { companyId: number; staffId: number | null } = { companyId: 1, staffId: 7 }) {
  const harnessUrl = new URL("./helpers/lifecycle-harness.mjs", import.meta.url).href;
  const authUrl = `data:text/javascript,export async function getSessionContext(){return ${JSON.stringify(session)}}`;
  const dbUrl = `data:text/javascript,export {getDb} from ${JSON.stringify(harnessUrl)};export async function syncReplica(){}`;
  const hooks = registerHooks({ resolve(specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) {
    if (specifier === "@/lib/auth") return { url: authUrl, shortCircuit: true };
    if (specifier === "@/lib/db") return { url: dbUrl, shortCircuit: true };
    if (specifier === "@/lib/sms") return { url: harnessUrl, shortCircuit: true };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  } });
  try {
    return await import(`../src/app/api/jobs/${path}/route.ts?operator=${++routeImport}`).catch(() => null);
  } finally {
    hooks.deregister();
  }
}

test("lifecycle route GET requires a session and scopes records by tenant and job", async t => {
  const database = lifecycleDatabase(); t.after(database.close);
  database.sqlite.exec(`
    INSERT INTO jobs(id,company_id,customer_id,scheduled_at,price_cents) VALUES
      (13,1,90,'2026-08-24T15:00:00.000Z',5000),
      (22,2,90,'2026-08-24T15:00:00.000Z',5000);
    INSERT INTO job_lifecycle_notifications
      (id,company_id,job_id,step,outcome,message_id,error,attempt_count,last_attempt_at,retry_requested_at,retry_requested_by)
    VALUES
      (101,1,12,'en_route','failed',55,'provider rejected',2,'2026-09-11 10:00:00','2026-09-11 09:00:00',7),
      (102,1,13,'arrived','pending',NULL,NULL,0,NULL,NULL,NULL),
      (103,2,22,'started','unknown',NULL,'timeout',1,'2026-09-11 10:00:00',NULL,NULL);
  `);

  const route = await loadOperatorRoute("[id]/lifecycle-notifications");
  assert.ok(route?.GET, "lifecycle notification GET route must exist");
  const response = await route.GET(new Request("https://example.com/api/jobs/12/lifecycle-notifications"), { params: { id: "12" } });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: 101, step: "en_route", outcome: "failed", attempt_count: 2,
    message_id: 55, error: "provider rejected", locked_at: null, created_at: rows[0].created_at,
    updated_at: rows[0].updated_at, last_attempt_at: "2026-09-11 10:00:00",
    retry_requested_at: "2026-09-11 09:00:00", retry_requested_by: 7,
  });

  const foreign = await loadOperatorRoute("[id]/lifecycle-notifications", { companyId: 2, staffId: 8 });
  assert.equal((await foreign!.GET(new Request("https://example.com"), { params: { id: "12" } })).status, 404);
  const unauthenticated = await loadOperatorRoute("[id]/lifecycle-notifications", null);
  assert.equal((await unauthenticated!.GET(new Request("https://example.com"), { params: { id: "12" } })).status, 401);
});

test("notification retry reopens failed delivery, audits the staff request, and immediately attempts delivery", async t => {
  const database = lifecycleDatabase(); t.after(database.close);
  database.sqlite.exec(`INSERT INTO job_lifecycle_notifications
    (id,company_id,job_id,step,outcome,customer_id,body,error,attempt_count)
    VALUES (201,1,12,'en_route','failed',90,'Technician is on the way','provider rejected',1)`);
  const route = await loadOperatorRoute("[id]/lifecycle-notifications/[notificationId]/retry");
  assert.ok(route?.POST, "lifecycle notification retry route must exist");
  const response = await route.POST(new Request("https://example.com/api/jobs/12/lifecycle-notifications/201/retry", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }), { params: { id: "12", notificationId: "201" } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).outcome, "sent");
  assert.equal(sends.length, 1);
  const row = database.sqlite.prepare("SELECT outcome, attempt_count, retry_requested_at, retry_requested_by FROM job_lifecycle_notifications WHERE id=201").get();
  assert.equal(row?.outcome, "sent");
  assert.equal(row?.attempt_count, 2);
  assert.match(String(row?.retry_requested_at), /^\d{4}-\d{2}-\d{2}/);
  assert.equal(row?.retry_requested_by, 7);
});

test("notification retry requires explicit unknown confirmation before accepting duplicate risk", async t => {
  const database = lifecycleDatabase(); t.after(database.close);
  database.sqlite.exec(`INSERT INTO job_lifecycle_notifications
    (id,company_id,job_id,step,outcome,customer_id,body,error,attempt_count)
    VALUES (202,1,12,'arrived','unknown',90,'Technician arrived','provider acceptance unknown',1)`);
  const route = await loadOperatorRoute("[id]/lifecycle-notifications/[notificationId]/retry");
  assert.ok(route?.POST, "lifecycle notification retry route must exist");
  const refused = await route!.POST(new Request("https://example.com", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }), { params: { id: "12", notificationId: "202" } });
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).error, /confirm_unknown/);
  assert.equal(sends.length, 0);
  assert.equal(database.sqlite.prepare("SELECT outcome FROM job_lifecycle_notifications WHERE id=202").get()?.outcome, "unknown");

  const accepted = await route!.POST(new Request("https://example.com", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm_unknown: true }),
  }), { params: { id: "12", notificationId: "202" } });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).outcome, "sent");
  assert.equal(sends.length, 1);
});

test("notification retry rejects sent, sending, pending, and skipped outcomes", async t => {
  const database = lifecycleDatabase(); t.after(database.close);
  for (const [index, outcome] of ["sent", "sending", "pending", "skipped"].entries()) {
    database.sqlite.prepare(`INSERT INTO job_lifecycle_notifications
      (id,company_id,job_id,step,outcome,customer_id,body,attempt_count)
      VALUES (?,1,12,?,?,90,'Prepared text',0)`).run(210 + index, ["en_route", "arrived", "started", "completed"][index], outcome);
  }
  const route = await loadOperatorRoute("[id]/lifecycle-notifications/[notificationId]/retry");
  assert.ok(route?.POST, "lifecycle notification retry route must exist");
  for (const id of [210, 211, 212, 213]) {
    const response = await route!.POST(new Request("https://example.com", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm_unknown: true }),
    }), { params: { id: "12", notificationId: String(id) } });
    assert.equal(response.status, 409, String(id));
  }
  assert.equal(sends.length, 0);
});

test("notification retry cannot inspect or mutate another tenant or another job", async t => {
  const database = lifecycleDatabase(); t.after(database.close);
  database.sqlite.exec(`INSERT INTO job_lifecycle_notifications
    (id,company_id,job_id,step,outcome,customer_id,body,error,attempt_count)
    VALUES (220,1,12,'completed','failed',90,'Job complete','provider rejected',1)`);
  const route = await loadOperatorRoute("[id]/lifecycle-notifications/[notificationId]/retry", { companyId: 2, staffId: 8 });
  assert.ok(route?.POST, "lifecycle notification retry route must exist");
  for (const jobId of ["12", "22"]) {
    const response = await route!.POST(new Request("https://example.com", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }), { params: { id: jobId, notificationId: "220" } });
    assert.equal(response.status, 404);
  }
  assert.equal(database.sqlite.prepare("SELECT outcome FROM job_lifecycle_notifications WHERE id=220").get()?.outcome, "failed");
  assert.equal(sends.length, 0);
});
