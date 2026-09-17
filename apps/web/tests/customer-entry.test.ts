import assert from "node:assert/strict";
// Node 24 exposes node:sqlite; the repository still uses Node 20 type definitions.
// @ts-expect-error Node 24 runtime API
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { elements, hookRenderer, loadCustomerModule, text } from "./helpers/customer-ui.mjs";

type TestGlobals = typeof globalThis & { __customerDb?: unknown; __customerQuery?: string; __customerPlaces?: unknown; __customerRouter?: unknown };
const globals = globalThis as TestGlobals;
const emptyAddress = { address_line1: "", unit: "", city: "", state: "", zip: "", latitude: null, longitude: null, formatted_address: "" };
const reverseResult = { features: [{ id: "address.1", place_type: ["address"], address: "123", text: "Main Street", place_name: "123 Main Street, Austin, Texas 78701, United States", center: [-97.76, 30.26], context: [
  { id: "postcode.1", text: "78701" }, { id: "place.1", text: "Austin" }, { id: "region.1", text: "Texas", short_code: "US-TX" }, { id: "country.1", text: "United States", short_code: "us" },
] }] };

function customerDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE customers (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, first_name TEXT, last_name TEXT, phone TEXT, email TEXT, address TEXT, address_line1 TEXT, unit TEXT, city TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL, formatted_address TEXT, notes TEXT)`);
  globals.__customerDb = { prepare: (sql: string) => {
    const statement = sqlite.prepare(sql);
    return { get: async (...args: never[]) => statement.get(...args), all: async (...args: never[]) => statement.all(...args), run: async (...args: never[]) => statement.run(...args) };
  } };
  return sqlite;
}

test("customer API creates a first-name-only customer and permits clearing an existing last name", async t => {
  const db = customerDatabase(); t.after(() => db.close());
  const create = await loadCustomerModule("app/api/customers/route.ts");
  const edit = await loadCustomerModule("app/api/customers/[id]/route.ts");
  const response = await create.POST(new Request("https://example.com/api/customers", { method: "POST", body: JSON.stringify({ first_name: "  Cher  " }) }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).name, "Cher");
  db.prepare("INSERT INTO customers (id,company_id,name,first_name,last_name) VALUES (20,1,'Ada Lovelace','Ada','Lovelace')").run();
  const updated = await edit.PATCH(new Request("https://example.com", { method: "PATCH", body: JSON.stringify({ last_name: "   " }) }), { params: { id: "20" } });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).name, "Ada");
  assert.equal(db.prepare("SELECT last_name FROM customers WHERE id = 20").get()?.last_name, "");
});

test("customer API still rejects empty first names and cannot update a foreign customer", async t => {
  const db = customerDatabase(); t.after(() => db.close());
  const create = await loadCustomerModule("app/api/customers/route.ts");
  const edit = await loadCustomerModule("app/api/customers/[id]/route.ts");
  const response = await create.POST(new Request("https://example.com", { method: "POST", body: JSON.stringify({ first_name: " ", last_name: "Lovelace" }) }));
  assert.equal(response.status, 400);
  db.prepare("INSERT INTO customers (id,company_id,name,first_name,last_name) VALUES (20,2,'Ada Lovelace','Ada','Lovelace')").run();
  const foreign = await edit.PATCH(new Request("https://example.com", { method: "PATCH", body: JSON.stringify({ last_name: "" }) }), { params: { id: "20" } });
  assert.equal(foreign.status, 404);
});

async function checkFirstNameOnly(component: (props: unknown) => unknown, props: Record<string, unknown>, expectedAddress: { address_line1: string; latitude: number | null; longitude: number | null } = emptyAddress) {
  const renderer = hookRenderer();
  let tree = renderer.render(component, props);
  const inputs = elements(tree, (el: any) => el.props.type === "text" && typeof el.props.onChange === "function");
  inputs[0].props.onChange({ target: { value: "Cher" } });
  assert.notEqual(inputs[1].props.required, true, "last name must not block native form submission");
  tree = renderer.render(component, props);
  let body: Record<string, unknown> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { body = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ id: 10, name: "Cher" }), { status: 201 }); };
  try {
    const form = elements(tree, (el: any) => el.type === "form")[0];
    if (form) await form.props.onSubmit({ preventDefault() {} });
    else await elements(tree, (el: any) => text(el) === "Save customer" && typeof el.props.onClick === "function")[0].props.onClick();
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(body?.first_name, "Cher");
  assert.equal(body?.last_name, "");
  assert.equal(body?.address_line1, expectedAddress.address_line1);
  assert.equal(body?.latitude, expectedAddress.latitude);
  assert.equal(body?.longitude, expectedAddress.longitude);
}

test("main customer form saves a first name without a last name", async () => {
  const module = await loadCustomerModule("components/customers/CustomerForm.tsx");
  await checkFirstNameOnly(module.default, { customer: null, variant: "page", onClose() {}, onSaved() {} });
});

for (const name of ["JobForm", "NewEstimateForm", "NewInvoiceForm", "NewSubscriptionForm"]) {
  test(`${name} quick-create saves a first name without a last name and includes the pin address`, async t => {
    globals.__customerQuery = "address=123+Main+St&latitude=30.25&longitude=-97.75";
    t.after(() => { globals.__customerQuery = ""; });
    const module = await loadCustomerModule(`components/${name}.tsx`);
    const renderer = hookRenderer();
    const props = name === "JobForm" ? { mode: "create" } : {};
    let tree = renderer.render(module.default, props);
    elements(tree, (el: any) => /\+.*New Customer/.test(text(el)) && typeof el.props.onClick === "function")[0].props.onClick();
    tree = renderer.render(module.default, props);
    const create = elements(tree, (el: any) => typeof el.props.onCreated === "function")[0];
    await checkFirstNameOnly(create.type, { ...create.props, onCreated() {} }, { address_line1: "123 Main St", latitude: 30.25, longitude: -97.75 });
  });
}

test("manual address edits discard stale geocoding when the city changes", async () => {
  const module = await loadCustomerModule("components/customers/AddressFields.tsx");
  let changed: unknown;
  const initial = { ...emptyAddress, address_line1: "123 Main St", city: "Austin", latitude: 30.2, longitude: -97.7, formatted_address: "123 Main St, Austin, TX" };
  const manual = hookRenderer().render(module.default, { value: initial, onChange: (next: unknown) => { changed = next; } });
  const tree = manual.type(manual.props);
  elements(tree, (el: any) => el.props["aria-label"] === "City")[0].props.onChange({ target: { value: "Houston" } });
  assert.deepEqual(changed, { ...initial, city: "Houston", latitude: null, longitude: null, formatted_address: "" });
});

test("customer creation takes the sale pin address and coordinates from navigation", async () => {
  globals.__customerQuery = "address=123+Main+St&latitude=30.25&longitude=-97.75&attach_pin=42";
  try {
    const module = await loadCustomerModule("components/customers/CustomerForm.tsx");
    const tree = hookRenderer().render(module.default, { customer: null, variant: "page", onClose() {}, onSaved() {} });
    const address = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
    assert.deepEqual(address.props.value, { ...emptyAddress, address_line1: "123 Main St", latitude: 30.25, longitude: -97.75 });
  } finally { globals.__customerQuery = ""; }
});

test("pin reverse lookup fills all address fields but preserves the original pin coordinates", async t => {
  globals.__customerQuery = "address=123+Main+St&latitude=30.25&longitude=-97.75&attach_pin=42";
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-token";
  let requestUrl = "";
  globalThis.fetch = async (url) => { requestUrl = String(url); return new Response(JSON.stringify(reverseResult)); };
  t.after(() => { globalThis.fetch = oldFetch; globals.__customerQuery = ""; if (oldToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN; else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = oldToken; });
  const module = await loadCustomerModule("components/customers/CustomerForm.tsx");
  const renderer = hookRenderer(); t.after(renderer.dispose);
  const props = { customer: null, variant: "page", onClose() {}, onSaved() {} };
  renderer.render(module.default, props); renderer.flushEffects();
  await new Promise(resolve => setImmediate(resolve));
  const tree = renderer.render(module.default, props);
  const address = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
  assert.deepEqual(address.props.value, { ...emptyAddress, address_line1: "123 Main Street", city: "Austin", state: "TX", zip: "78701", formatted_address: "123 Main Street, Austin, Texas 78701, United States", latitude: 30.25, longitude: -97.75 });
  assert.match(requestUrl, /-97\.75,30\.25/);
});

test("late pin lookup cannot overwrite address edits", async t => {
  globals.__customerQuery = "address=123+Main+St&latitude=30.25&longitude=-97.75&attach_pin=42";
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-token";
  let finish: ((value: Response) => void) | undefined;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  t.after(() => { globalThis.fetch = oldFetch; globals.__customerQuery = ""; if (oldToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN; else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = oldToken; });
  const module = await loadCustomerModule("components/customers/CustomerForm.tsx");
  const renderer = hookRenderer(); t.after(renderer.dispose);
  const props = { customer: null, variant: "page", onClose() {}, onSaved() {} };
  let tree = renderer.render(module.default, props); renderer.flushEffects();
  const address = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
  address.props.onChange({ ...emptyAddress, address_line1: "999 Chosen St", city: "Houston" });
  assert.ok(finish, "pin address lookup should start");
  finish(new Response(JSON.stringify(reverseResult)));
  await new Promise(resolve => setImmediate(resolve));
  tree = renderer.render(module.default, props);
  const edited = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
  assert.equal(edited.props.value.address_line1, "999 Chosen St");
  assert.equal(edited.props.value.city, "Houston");
});

test("pin address prefill rejects invalid coordinates without treating a missing coordinate as zero", async () => {
  globals.__customerQuery = "address=123+Main+St&latitude=91&longitude=-97.75";
  try {
    const module = await loadCustomerModule("components/customers/CustomerForm.tsx");
    const props = { customer: null, variant: "page", onClose() {}, onSaved() {} };
    let tree = hookRenderer().render(module.default, props);
    let address = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
    assert.equal(address.props.value.address_line1, "123 Main St");
    assert.equal(address.props.value.latitude, null);
    assert.equal(address.props.value.longitude, null);
    globals.__customerQuery = "address=123+Main+St&longitude=0";
    tree = hookRenderer().render(module.default, props);
    address = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
    assert.equal(address.props.value.latitude, null);
    assert.equal(address.props.value.longitude, null);
  } finally { globals.__customerQuery = ""; }
});

test("customers list retains the pin address while removing creation parameters from the URL", async t => {
  globals.__customerQuery = "new=1&address=123+Main+St&latitude=30.25&longitude=-97.75&attach_pin=42";
  globals.__customerRouter = { replace() { globals.__customerQuery = ""; }, push() {}, refresh() {} };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("[]");
  t.after(() => { globalThis.fetch = oldFetch; globals.__customerQuery = ""; globals.__customerRouter = undefined; });
  const module = await loadCustomerModule("app/(app)/customers/page.tsx");
  const page = module.default().props.children;
  const renderer = hookRenderer(); t.after(renderer.dispose);
  renderer.render(page.type, page.props); renderer.flushEffects();
  const tree = renderer.render(page.type, page.props);
  const form = elements(tree, (el: any) => typeof el.props.onSaved === "function")[0];
  assert.ok(form);
  const fields = hookRenderer().render(form.type, form.props);
  const address = elements(fields, (el: any) => el.props.value?.address_line1 !== undefined)[0];
  assert.deepEqual(address.props.value, { ...emptyAddress, address_line1: "123 Main St", latitude: 30.25, longitude: -97.75 });
});

test("pin reverse lookup failure keeps the original address editable and explains manual fallback", async t => {
  globals.__customerQuery = "address=123+Main+St&latitude=30.25&longitude=-97.75";
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-token";
  globalThis.fetch = async () => new Response("denied", { status: 403 });
  t.after(() => { globalThis.fetch = oldFetch; globals.__customerQuery = ""; if (oldToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN; else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = oldToken; });
  const module = await loadCustomerModule("components/customers/CustomerForm.tsx");
  const renderer = hookRenderer(); t.after(renderer.dispose);
  const props = { customer: null, variant: "page", onClose() {}, onSaved() {} };
  renderer.render(module.default, props); renderer.flushEffects();
  await new Promise(resolve => setImmediate(resolve));
  const tree = renderer.render(module.default, props);
  const address = elements(tree, (el: any) => el.props.value?.address_line1 !== undefined)[0];
  assert.deepEqual(address.props.value, { ...emptyAddress, address_line1: "123 Main St", latitude: 30.25, longitude: -97.75 });
  assert.match(address.props.prefillMessage, /manual/i);
});

test("door knock customer creation accepts a first name without a last name", async t => {
  const module = await loadCustomerModule("components/MapDoorKnockSheet.tsx");
  const oldFetch = globalThis.fetch;
  let payload: any;
  globalThis.fetch = async (url, init) => { if (url === "/api/customers") payload = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ id: 42 })); };
  t.after(() => { globalThis.fetch = oldFetch; });
  const renderer = hookRenderer();
  const props = { pin: { id: 42, lat: 30.25, lng: -97.75, first_name: "Cher", address: "123 Main St" }, onClose() {}, onSaved() {} };
  const tree = renderer.render(module.default, props);
  await elements(tree, (el: any) => text(el) === "Create Customer" && typeof el.props.onClick === "function")[0].props.onClick();
  assert.equal(payload?.first_name, "Cher");
  assert.equal(payload?.last_name, "");
});
