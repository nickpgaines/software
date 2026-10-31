import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadRegistrationReviewSupport, registrationDatabase } from "./helpers/sms-registration-harness.mjs";
import { elements, hookRenderer, loadCustomerModule, text } from "./helpers/customer-ui.mjs";

const originalFetch = globalThis.fetch;
let db: ReturnType<typeof registrationDatabase>;
const now = Date.parse("2026-10-31T12:00:00Z");
const day = 86_400_000;
afterEach(() => { globalThis.fetch = originalFetch; db?.close(); db = undefined!; });

async function loader() {
  const module = await loadRegistrationReviewSupport().catch(() => null);
  assert.ok(module, "provider-confirmed review support helper must exist");
  return module.getRegistrationReviewSupport;
}
function setup(state = "trust_product_pending") {
  db = registrationDatabase(state);
  db.prepare("UPDATE company SET twilio_trust_product_sid = 'BUtrust', twilio_brand_sid = 'BNbrand', twilio_campaign_sid = 'QEcampaign', twilio_messaging_service_sid = 'MGservice', a2p_registration_started_at = '2026-01-01'").run();
}
function provider(sid = "BUtrust", status = "in-review", age = 8, extra = {}) {
  return { sid, status, campaign_status: status, date_updated: new Date(now - age * day).toISOString(), ...extra };
}
function respond(resource: object, status = 200) {
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.method, "GET", "support lookup must not create or resubmit anything");
    assert.match(String(url), /twilio.com\/v1\//);
    assert.equal((options?.headers as Record<string, string>).Authorization, `Basic ${Buffer.from("ACtest:test-token").toString("base64")}`);
    return Response.json(resource, { status });
  };
}

test("confirmed overdue review yields only safe tenant-specific support details", async () => {
  setup(); respond(provider("BUtrust", "in-review", 8, { auth_token: "secret", ein: "12-3456789", email: "private@example.com" }));
  const get = await loader();
  const result = await get(1, "trust_product_pending", now);
  assert.deepEqual(result, {
    state: "trust_product_pending", stage: "Trust product", providerStatus: "IN_REVIEW",
    lastUpdatedAt: new Date(now - 8 * day).toISOString(), checkedAt: new Date(now).toISOString(),
    companyName: "Example Cleaning", accountSid: "ACtest", resourceSid: "BUtrust", messagingServiceSid: null,
  });
  assert.doesNotMatch(JSON.stringify(result), /test-token|secret|12-3456789|private@example/);
});

test("missing company display name uses a neutral summary label", async () => {
  setup(); db.prepare("UPDATE company SET name = NULL").run(); respond(provider());
  const get = await loader(); assert.equal((await get(1, "trust_product_pending", now))?.companyName, "Business");
});

test("review age is based on current provider stage, not old company submission", async () => {
  setup(); const get = await loader();
  for (const age of [0, 6.99, -1]) { respond(provider("BUtrust", "in-review", age)); assert.equal(await get(1, "trust_product_pending", now), null); }
  for (const date of [null, "", "not a date"]) { respond(provider("BUtrust", "in-review", 100, { date_updated: date })); assert.equal(await get(1, "trust_product_pending", now), null); }
});

test("all four stages use their own resource and conservative threshold", async () => {
  setup(); const get = await loader();
  for (const [state, sid, days, path] of [
    ["customer_profile_pending", "BUprofile", 7, "CustomerProfiles/BUprofile"],
    ["trust_product_pending", "BUtrust", 7, "TrustProducts/BUtrust"],
    ["brand_pending", "BNbrand", 2, "BrandRegistrations/BNbrand"],
    ["campaign_pending", "QEcampaign", 10, "Services/MGservice/Compliance/Usa2p/QEcampaign"],
  ] as const) {
    db.prepare("UPDATE company SET a2p_registration_state = ?").run(state);
    let age: number = days;
    globalThis.fetch = async (url) => { assert.ok(String(url).endsWith(path)); return Response.json(provider(sid, "IN_REVIEW", age)); };
    const result = await get(1, state, now);
    assert.ok(result); assert.equal(result.resourceSid, sid);
    assert.equal(result.messagingServiceSid, state === "campaign_pending" ? "MGservice" : null);
    age -= 0.001; assert.equal(await get(1, state, now), null);
  }
});

test("provider rejection, approval, unknown status, failures and mismatched resources never blame Twilio", async () => {
  setup(); const get = await loader();
  for (const status of ["twilio-rejected", "TWILIO_APPROVED", "APPROVED", "FAILED", "DRAFT", "unknown"]) {
    respond(provider("BUtrust", status)); assert.equal(await get(1, "trust_product_pending", now), null);
  }
  respond(provider("BUother")); assert.equal(await get(1, "trust_product_pending", now), null);
  respond(provider("BUtrust", "in-review", 20, { account_sid: "ACother" })); assert.equal(await get(1, "trust_product_pending", now), null);
  respond({ message: "unavailable" }, 503); assert.equal(await get(1, "trust_product_pending", now), null);
  globalThis.fetch = async () => { throw new Error("offline"); }; assert.equal(await get(1, "trust_product_pending", now), null);
});

test("missing tenant, credential, resource and changed local stage suppress lookup or stale guidance", async () => {
  setup(); const get = await loader();
  globalThis.fetch = async () => { assert.fail("must not contact Twilio"); };
  assert.equal(await get(2, "trust_product_pending", now), null);
  assert.equal(await get(1, "brand_pending", now), null);
  assert.equal(await get(1, "trust_product_failed", now), null);
  db.prepare("UPDATE company SET twilio_subaccount_auth_token = NULL").run();
  assert.equal(await get(1, "trust_product_pending", now), null);
  db.prepare("UPDATE company SET twilio_subaccount_auth_token = 'test-token', twilio_trust_product_sid = NULL").run();
  assert.equal(await get(1, "trust_product_pending", now), null);
  db.prepare("UPDATE company SET twilio_trust_product_sid = 'BUtrust'").run();
  globalThis.fetch = async () => { db.prepare("UPDATE company SET a2p_registration_state = 'trust_product_failed'").run(); return Response.json(provider()); };
  assert.equal(await get(1, "trust_product_pending", now), null);
});

const details = {
  state: "trust_product_pending", stage: "Trust product", providerStatus: "IN_REVIEW",
  lastUpdatedAt: "2026-06-03T12:00:00Z", checkedAt: "2026-10-31T12:00:00Z",
  companyName: "Example Cleaning", accountSid: "ACtest", resourceSid: "BUtrust", messagingServiceSid: null,
};
async function component() {
  const module = await loadCustomerModule("components/SmsRegistrationSupport.tsx").catch(() => null);
  assert.ok(module, "customer-facing review support component must exist"); return module.SmsRegistrationSupport;
}
test("notice links directly to Twilio, explains control and account access, without Forge support route", async () => {
  const Component = await component();
  const html = renderToStaticMarkup(createElement(Component, { details }));
  assert.match(html, /https:\/\/help.twilio.com\/articles\/360048500694/);
  assert.match(html, /Contact Twilio Support/); assert.match(html, /Copy registration details/);
  assert.match(html, /Forge cannot approve or expedite/); assert.match(html, /account owner/);
  assert.match(html, /target="_blank"/); assert.match(html, /noopener noreferrer/);
  assert.doesNotMatch(html, /mailto:|support@forge/);
});

test("copy action uses safe summary, reports success, and offers selectable fallback if clipboard fails", async () => {
  const Component = await component(); const hooks = hookRenderer();
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied = "";
  try {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value: string) => { copied = value; } } } });
    let tree = hooks.render(Component, { details });
    const copy = () => elements(tree, (e: any) => !!e.props.onClick && text(e).includes("Copy registration details"))[0].props.onClick();
    await copy(); tree = hooks.render(Component, { details });
    assert.match(copied, /ACtest/); assert.match(copied, /BUtrust/); assert.match(copied, /2026-06-03/);
    assert.match(text(tree), /Copied/);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    await copy(); tree = hooks.render(Component, { details });
    const fallback = elements(tree, (e: any) => e.type === "textarea")[0];
    assert.ok(fallback); assert.equal(fallback.props.readOnly, true); assert.equal(fallback.props.value, copied);
    assert.match(text(tree), /select and copy/i);
  } finally { hooks.dispose(); if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator); else Reflect.deleteProperty(globalThis, "navigator"); }
});

test("messaging panel hides old support details during refresh and rejects out-of-order results", async () => {
  const { default: SettingsTabs } = await loadCustomerModule("components/SettingsTabs.tsx");
  const previousQuery = (globalThis as any).__customerQuery;
  (globalThis as any).__customerQuery = "tab=messaging";
  const hooks = hookRenderer(); const outerHooks = hookRenderer();
  const payload = { registration: null, company: { a2p_registration_state: details.state }, reviewSupport: details };
  try {
    const wrapper = SettingsTabs({ username: "admin", connectorUrl: "", initialMe: { is_admin_account: true } });
    const inner = wrapper.props.children;
    const tabs = outerHooks.render(inner.type, inner.props);
    const panel = elements(tabs, (e: any) => typeof e.type === "function" && e.type.name === "MessagingPanel")[0];
    assert.ok(panel);
    globalThis.fetch = async () => Response.json(payload);
    hooks.render(panel.type, panel.props); hooks.flushEffects();
    await new Promise((resolve) => setImmediate(resolve));
    let tree = hooks.render(panel.type, panel.props);
    const notice = () => elements(tree, (e: any) => e.type.name === "SmsRegistrationSupport");
    const refresh = () => elements(tree, (e: any) => e.type.name === "RegistrationStatusCard")[0].props.onRefresh();
    assert.equal(notice().length, 1);
    const pending: Array<(value: Response) => void> = [];
    globalThis.fetch = () => new Promise((resolve) => pending.push(resolve));
    const first = refresh(); tree = hooks.render(panel.type, panel.props);
    assert.equal(notice().length, 0);
    const second = refresh();
    pending[1](Response.json({ error: "Unavailable" }, { status: 503 })); await second;
    tree = hooks.render(panel.type, panel.props);
    assert.match(text(tree), /Unable to refresh registration status/);
    pending[0](Response.json(payload)); await first;
    tree = hooks.render(panel.type, panel.props); assert.equal(notice().length, 0);
  } finally { hooks.dispose(); outerHooks.dispose(); (globalThis as any).__customerQuery = previousQuery; }
});
