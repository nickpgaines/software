import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 24 runtime API; repository uses Node 20 type definitions.
import { DatabaseSync } from "node:sqlite";
import { elements, hookRenderer, loadCustomerModule, text } from "./helpers/customer-ui.mjs";
import { resolveSalesRange } from "../src/lib/sales-report-range.ts";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE map_pins (company_id INTEGER, created_at TEXT, status TEXT, created_by TEXT, objections TEXT);
    CREATE TABLE jobs (id INTEGER, company_id INTEGER, scheduled_at TEXT, price_cents INTEGER, recurring INTEGER, status TEXT);
    CREATE TABLE staff (id INTEGER, company_id INTEGER, name TEXT, email TEXT);
    CREATE TABLE job_assignments (job_id INTEGER, staff_id INTEGER, role TEXT);
    CREATE TABLE customer_subscriptions (company_id INTEGER, status TEXT, start_date TEXT, accepted_at TEXT, created_at TEXT, sold_by_id INTEGER, price_cents INTEGER, interval TEXT, tax_rate_bps INTEGER);
    INSERT INTO staff VALUES (1,1,'Test Rep','rep@example.com');
  `);
  (globalThis as any).__customerDb = { prepare(sql: string) {
    const s = db.prepare(sql);
    return { all: async (...args: any[]) => s.all(...args), get: async (...args: any[]) => s.get(...args) };
  } };
  return db;
}

test("Sales includes SQLite and ISO pins on the selected local day, without adjacent days or other tenants", async t => {
  const db = fixture(); t.after(() => db.close());
  db.exec(`INSERT INTO map_pins VALUES
    (1,'2026-09-18 05:00:00','quote','Test Rep','["Price"]'),
    (1,'2026-09-19T04:59:59.999Z','sale','Test Rep','["Timing"]'),
    (1,'2026-09-18 04:59:59','not_home','Test Rep',NULL),
    (1,'2026-09-19T05:00:00Z','not_home','Test Rep',NULL),
    (2,'2026-09-18 18:00:00','sale','Test Rep',NULL);`);
  const { GET } = await loadCustomerModule("app/api/reports/sales/route.ts");
  const response = await GET(new Request("https://example.com/api/reports/sales?range=custom&start=2026-09-18&end=2026-09-18&timeZone=America/Chicago"));
  const result = await response.json();
  assert.equal(result.funnel.pins_added.count, 2);
  assert.equal(result.pin_status.team_totals.total, 2);
  assert.equal(result.reps[0].pins, 2);
  assert.equal(result.reps[0].sales, 1);
  assert.equal(result.objections.pins_with_objections, 2);
  assert.equal(result.start, "2026-09-18T05:00:00.000Z");
  assert.equal(result.end, "2026-09-19T05:00:00.000Z");
  assert.deepEqual(result.trends.one_time_series, [{ date: "2026-09-18", cents: 0 }]);
});

test("Sales totals and daily charts agree for date-only subscriptions and mixed UTC job timestamps", async t => {
  const db = fixture(); t.after(() => db.close());
  db.exec(`INSERT INTO customer_subscriptions VALUES (1,'active','2026-09-18',NULL,NULL,1,1000,'monthly',0);
    INSERT INTO jobs VALUES (1,1,'2026-09-18 18:00:00',2500,0,'scheduled'), (2,1,'2026-09-19T04:00:00Z',3500,0,'scheduled');
    INSERT INTO job_assignments VALUES (1,1,'sales'),(2,1,'sales');`);
  const { GET } = await loadCustomerModule("app/api/reports/sales/route.ts");
  const result = await (await GET(new Request("https://example.com/api/reports/sales?range=custom&start=2026-09-18&end=2026-09-18&timeZone=America/Chicago"))).json();
  assert.equal(result.revenue_sold.one_time.cents, 6000);
  assert.equal(result.revenue_sold.arr_sold.cents, 12000);
  assert.deepEqual(result.trends.one_time_series, [{ date: "2026-09-18", cents: 6000 }]);
  assert.deepEqual(result.trends.arr_sold_series, [{ date: "2026-09-18", cents: 12000 }]);
  assert.equal(result.reps[0].total_revenue_cents, 18000);
});

for (const [day, start, end] of [
  ["2026-03-08", "2026-03-08T06:00:00.000Z", "2026-03-09T05:00:00.000Z"],
  ["2026-11-01", "2026-11-01T05:00:00.000Z", "2026-11-02T06:00:00.000Z"],
]) test(`Sales uses full local calendar days across DST on ${day}`, async t => {
  const db = fixture(); t.after(() => db.close());
  const { GET } = await loadCustomerModule("app/api/reports/sales/route.ts");
  const result = await (await GET(new Request(`https://example.com/api/reports/sales?range=custom&start=${day}&end=${day}&timeZone=America/Chicago`))).json();
  assert.equal(result.start, start); assert.equal(result.end, end);
  assert.deepEqual(result.trends.one_time_series.map((p: any) => p.date), [day]);
});

test("Sales rejects malformed, reversed, or unbounded custom ranges and invalid time zones", async t => {
  const db = fixture(); t.after(() => db.close());
  const { GET } = await loadCustomerModule("app/api/reports/sales/route.ts");
  for (const query of [
    "range=custom&start=2026-02-30&end=2026-03-01",
    "range=custom&start=2026-09-19&end=2026-09-18",
    "range=custom&start=2026-09-18", "range=custom&start=1900-01-01&end=9999-01-01",
    "range=today&timeZone=invalid",
  ]) assert.equal((await GET(new Request(`https://example.com/api/reports/sales?${query}`))).status, 400, query);
});

test("Today and Yesterday use the user's date even when UTC is already tomorrow", () => {
  const now = new Date("2026-09-19T02:00:00Z");
  const today = resolveSalesRange(new URL("https://example.com?range=today&timeZone=America/Chicago"), now);
  const yesterday = resolveSalesRange(new URL("https://example.com?range=yesterday&timeZone=America/Chicago"), now);
  assert.equal(today.start.toISOString(), "2026-09-18T05:00:00.000Z");
  assert.equal(today.end.toISOString(), "2026-09-19T05:00:00.000Z");
  assert.equal(yesterday.start.toISOString(), "2026-09-17T05:00:00.000Z");
  assert.equal(yesterday.end.toISOString(), "2026-09-18T05:00:00.000Z");
  const dst = resolveSalesRange(new URL("https://example.com?range=custom&start=2026-03-08&end=2026-03-08&timeZone=America/Chicago"), now);
  assert.equal(dst.prior.start.toISOString(), "2026-03-07T06:00:00.000Z");
  assert.equal(dst.prior.end.toISOString(), "2026-03-08T06:00:00.000Z");
});

test("Sales date controls offer daily shortcuts, navigate dates, and transmit the browser timezone", async t => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "document", { configurable: true, value: Object.assign(new EventTarget(), { hidden: false }) });
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  const { default: Reports } = await loadCustomerModule("components/ReportsClient.tsx");
  const render = hookRenderer(); t.after(() => render.dispose());
  let tree = render.render(Reports);
  elements(tree, (el: any) => text(el) === "Sales" && typeof el.props.onClick === "function")[0].props.onClick();
  tree = render.render(Reports);
  const control = elements(tree, (el: any) => typeof el.props.onQueryChange === "function")[0];
  assert.ok(control, "Sales must use its daily date controls, not the legacy report range");
  elements(tree, (el: any) => text(el) === "Jobs" && typeof el.props.onClick === "function")[0].props.onClick();
  const otherTab = render.render(Reports);
  assert.ok(elements(otherTab, (el: any) => el.type === control.type).length, "retain mounted Sales controls when comparing another report so date selection is not lost");
  const controls = hookRenderer(); t.after(() => controls.dispose());
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  });
  let query = "";
  const props = { ...control.props, onQueryChange: (q: string) => { query = q; } };
  let dates = controls.render(control.type, props);
  controls.flushEffects();
  dates = controls.render(control.type, props);
  elements(dates, (el: any) => text(el) === "Today" && typeof el.props.onSelect === "function")[0].props.onSelect();
  dates = controls.render(control.type, props); controls.flushEffects();
  assert.equal(new URLSearchParams(query).get("range"), "today");
  assert.equal(new URLSearchParams(query).get("timeZone"), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = new URLSearchParams(query).get("start");
  elements(dates, (el: any) => el.props["aria-label"] === "Previous day")[0].props.onClick();
  dates = controls.render(control.type, props); controls.flushEffects();
  const previous = new URLSearchParams(query);
  assert.equal(previous.get("range"), "custom");
  assert.equal(previous.get("start"), previous.get("end"));
  assert.notEqual(previous.get("start"), today);
  elements(dates, (el: any) => el.props["aria-label"] === "Next day")[0].props.onClick();
  controls.render(control.type, props); controls.flushEffects();
  assert.equal(new URLSearchParams(query).get("start"), today);
  dates = controls.render(control.type, props);
  elements(dates, (el: any) => el.props["aria-label"] === "Sales start date")[0].props.onChange({ target: { value: "2026-09-18" } });
  elements(dates, (el: any) => el.props["aria-label"] === "Sales end date")[0].props.onChange({ target: { value: "2026-09-18" } });
  dates = controls.render(control.type, props); controls.flushEffects();
  assert.equal(new URLSearchParams(query).get("start"), "2026-09-18");
  assert.equal(new URLSearchParams(query).get("end"), "2026-09-18");
  elements(dates, (el: any) => el.props["aria-label"] === "Sales end date")[0].props.onChange({ target: { value: "2026-09-17" } });
  dates = controls.render(control.type, props); controls.flushEffects();
  assert.equal(query, "", "invalid dates must not keep displaying the previous report");
  assert.match(text(dates), /end date on or after/);
});

test("Sales waits for valid dates and shows API failures instead of crashing or showing stale numbers", async t => {
  const { default: Reports } = await loadCustomerModule("components/ReportsClient.tsx");
  const parent = hookRenderer(); t.after(() => parent.dispose());
  let tree = parent.render(Reports);
  elements(tree, (el: any) => text(el) === "Sales" && typeof el.props.onClick === "function")[0].props.onClick();
  tree = parent.render(Reports);
  const panel = elements(tree, (el: any) => el.type?.name === "SalesPanel")[0];
  const render = hookRenderer(); t.after(() => render.dispose());
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Report unavailable" }, { status: 500 }));
  render.render(panel.type, { qs: "" }); render.flushEffects();
  assert.equal(fetch.mock.callCount(), 0, "do not request server-local fallback while browser dates load");
  render.render(panel.type, { qs: "range=today&timeZone=America/Chicago" }); render.flushEffects();
  await new Promise(resolve => setImmediate(resolve));
  const result = render.render(panel.type, { qs: "range=today&timeZone=America/Chicago" });
  assert.match(text(result), /Report unavailable/);
});
