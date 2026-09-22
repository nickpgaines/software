import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-ignore the shared UI harness loads production TSX through Node's strip-types test runtime.
import {
  elements,
  hookRenderer,
  loadCustomerModule,
  text,
} from "./helpers/customer-ui.mjs";

type BillingModule = typeof import("../src/components/billing/ForgeBilling");

const baseStatus = {
  enabled: true as const,
  allowed: false,
  reason: "subscription_required" as const,
  trialEndsAt: "2026-10-05T18:30:00.000Z",
  plan: null,
  interval: null,
  seatLimit: null,
  staffCount: 3,
  paidThrough: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  canManage: true,
  native: false,
};

function renderView(
  module: BillingModule,
  props: Partial<React.ComponentProps<BillingModule["ForgeBillingView"]>> = {},
) {
  return renderToStaticMarkup(
    React.createElement(module.ForgeBillingView, {
      state: { kind: "ready", status: baseStatus },
      interval: null,
      pending: null,
      localNative: false,
      standalone: true,
      onSelectInterval() {},
      onCheckout() {},
      onPortal() {},
      onRefresh() {},
      onRetry() {},
      ...props,
    }),
  );
}

test("expired trial has an explicit heading without mislabeling paid or failed renewals", async () => {
  const module = (await loadCustomerModule("components/billing/ForgeBilling.tsx")) as BillingModule;
  assert.match(renderView(module), /Your free trial has ended/);
  for (const status of [
    { ...baseStatus, allowed: true, reason: "trial" as const },
    { ...baseStatus, allowed: true, reason: "paid" as const },
    { ...baseStatus, subscriptionStatus: "past_due" },
  ]) {
    assert.doesNotMatch(renderView(module, { state: { kind: "ready", status } }), /Your free trial has ended/);
  }
});

test("annual plan choice shows exact upfront totals and a highlighted Team option", async () => {
  const module = (await loadCustomerModule("components/billing/ForgeBilling.tsx")) as BillingModule;
  const markup = renderView(module, { interval: "year" });
  assert.match(markup, /Most popular/);
  assert.match(markup, /Annual — 2 months free/);
  assert.match(markup, /\$790[^<]*<\/span><span[^>]*>\/ year/);
  assert.match(markup, /\$1,490[^<]*<\/span><span[^>]*>\/ year/);
  assert.match(markup, /\$2,290[^<]*<\/span><span[^>]*>\/ year/);
  assert.match(markup, /Billed annually/);
  assert.doesNotMatch(markup, /API access|Payroll tracking|Everything in Solo/);
});

test("off and unresolved billing never render a subscription pitch", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;

  for (const state of [
    { kind: "loading" as const },
    { kind: "ready" as const, status: { enabled: false as const } },
  ]) {
    const markup = renderView(module, { state });
    assert.doesNotMatch(markup, /\$79|Subscribe|Checkout|Manage subscription/);
  }
});

test("web billing administrator explicitly chooses an interval and cannot choose an undersized plan", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const choices: string[] = [];
  const tree = module.ForgeBillingView({
    state: { kind: "ready", status: baseStatus },
    interval: null,
    pending: null,
    localNative: false,
    standalone: false,
    onSelectInterval: (interval) => choices.push(interval),
    onCheckout() {},
    onPortal() {},
    onRefresh() {},
    onRetry() {},
  });
  const markup = renderToStaticMarkup(tree);

  assert.match(markup.replace(/<[^>]*>/g, ""), /\$79\s*\/ month/);
  assert.match(markup, /\$790[^<]*\/ year/);
  assert.match(markup, /1 employee/);
  assert.match(markup, /\$1,490[^<]*\/ year/);
  assert.match(markup, /8 employees/);
  assert.match(markup, /\$2,290[^<]*\/ year/);
  assert.match(markup, /30 employees/);
  assert.match(markup, /Choose monthly or annual billing/);
  assert.doesNotMatch(markup, /per month when billed annually/i);

  const toggle = elements(tree, (element: React.ReactElement) =>
    (element.type as { name?: string }).name === "BillingIntervalToggle",
  )[0];
  const toggleTree = (toggle.type as Function)(toggle.props);
  const buttons = elements(toggleTree, (element: React.ReactElement) =>
    element.type === "button" ||
    (element.type as { displayName?: string }).displayName === "Button",
  );
  const annual = buttons.find((button: React.ReactElement) => text(button) === "Annual — 2 months free")!;
  assert.equal(annual.props["aria-pressed"], false);
  annual.props.onClick();
  assert.deepEqual(choices, ["year"]);

  const plans = module.PlanCards({
    status: baseStatus,
    interval: null,
    pending: null,
    onCheckout() {},
  });
  const planButtons = elements(plans, (element: React.ReactElement) =>
    element.type === "button" ||
    (element.type as { displayName?: string }).displayName === "Button",
  );
  const solo = planButtons.find((button: React.ReactElement) =>
    text(button).includes("Solo"),
  )!;
  assert.equal(solo.props.disabled, true);
  assert.match(text(solo), /Requires 1 employee/);
});

test("marketing pricing switches interval and discloses the exact annual bill", async () => {
  const { PricingSection } = await loadCustomerModule("components/marketing/PricingSection.tsx");
  const renderer = hookRenderer();
  const annual = renderer.render(PricingSection);
  const annualMarkup = renderToStaticMarkup(annual);
  assert.match(annualMarkup, /\$790 billed yearly/);
  assert.match(annualMarkup, /\$1,490 billed yearly/);
  assert.match(annualMarkup, /\$2,290 billed yearly/);
  assert.match(annualMarkup, /Most popular/);
  assert.match(annualMarkup, /Unlimited customers/);
  const toggle = elements(annual, (element: React.ReactElement) =>
    (element.type as { name?: string }).name === "BillingIntervalToggle",
  )[0];
  const buttons = elements((toggle.type as Function)(toggle.props), (element: React.ReactElement) =>
    (element.type as { displayName?: string }).displayName === "Button",
  );
  buttons.find((button: React.ReactElement) => text(button) === "Monthly")!.props.onClick();
  const monthly = renderToStaticMarkup(renderer.render(PricingSection));
  assert.match(monthly, /\$79<\/span>/);
  assert.match(monthly, /\$149<\/span>/);
  assert.match(monthly, /\$229<\/span>/);
  assert.doesNotMatch(monthly, /billed yearly/);
  renderer.dispose();
});

test("pending billing actions disable the shared interval toggle", async () => {
  const module = (await loadCustomerModule("components/billing/ForgeBilling.tsx")) as BillingModule;
  const markup = renderView(module, { pending: "checkout", interval: "month" });
  assert.match(markup, /disabled="" aria-pressed="true"[^>]*>Monthly/);
  assert.match(markup, /disabled="" aria-pressed="false"[^>]*>Annual/);
});

test("ordinary employees and native users see status without prices or purchase management", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const employee = renderView(module, {
    state: {
      kind: "ready",
      status: { ...baseStatus, canManage: false, staffCount: 1 },
    },
  });
  assert.match(employee, /Contact an administrator/);
  assert.doesNotMatch(employee, /\$79|Subscribe|Manage subscription|Download company data/);

  for (const nativeState of [
    { ...baseStatus, native: true, staffCount: 1 },
    { ...baseStatus, native: false, staffCount: 1 },
  ]) {
    const native = renderView(module, {
      state: { kind: "ready", status: nativeState },
      localNative: true,
    });
    assert.match(native, /account status/i);
    assert.match(native, /Download company data/);
    assert.doesNotMatch(
      native,
      /\$79|Subscribe|Manage subscription|open.*website|browser.*subscribe/i,
    );
  }
});

test("approved native website handoff opens a new browser context without exposing pricing", async () => {
  const module = (await loadCustomerModule("components/billing/ForgeBilling.tsx")) as BillingModule;
  const status = { ...baseStatus, native: true, websiteBillingUrl: "https://forge.test/billing" };
  const markup = renderView(module, { state: { kind: "ready", status } });
  assert.match(markup, /href="https:\/\/forge.test\/billing" target="_blank" rel="noopener noreferrer"/);
  assert.match(markup, /Continue on website/);
  assert.match(markup, /sign in again/i);
  assert.doesNotMatch(markup, /Native Account Status|\$79|Subscribe to/);
  for (const variant of [
    { ...status, canManage: false },
    { ...status, websiteBillingUrl: null },
    { ...status, native: false },
  ]) {
    assert.doesNotMatch(renderView(module, {state:{kind:"ready",status:variant}}), /Continue on website/);
  }
});

test("native trial access shows its company expiration and offers Forge without purchase instructions", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const markup = renderView(module, {
    state: {
      kind: "ready",
      status: {
        ...baseStatus,
        allowed: true,
        reason: "trial",
        native: true,
      },
    },
    localNative: true,
  });

  assert.match(markup, /Continue to Forge/);
  assert.match(markup, /14-day trial ends/);
  assert.match(markup, /October 5, 2026/);
  assert.doesNotMatch(markup, /Starting a subscription now begins paid billing/i);
});

test("provider failure is retryable while an expired session gets a sign-in action", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const unavailable = renderView(module, {
    state: {
      kind: "error",
      status: 503,
      message: "Billing is temporarily unavailable.",
    },
    actionError: "Could not log out. Please check your connection and try again.",
  });
  assert.match(unavailable, /temporarily unavailable/i);
  assert.match(unavailable, /Could not log out/);
  assert.match(unavailable, />Retry</);
  assert.doesNotMatch(unavailable, /href="\/login"/);

  const stale = renderView(module, {
    state: { kind: "error", status: 401, message: "Unauthorized" },
  });
  assert.match(stale, /session has expired/i);
  assert.match(stale, /href="\/login\?next=%2Fbilling"/);
  assert.doesNotMatch(stale, />Retry</);
});

test("an existing nonterminal subscription offers portal and refresh without a second checkout", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const markup = renderView(module, {
    state: {
      kind: "ready",
      status: {
        ...baseStatus,
        allowed: true,
        reason: "paid",
        plan: "team",
        interval: "year",
        seatLimit: 8,
        subscriptionStatus: "active",
        paidThrough: "2027-09-26T05:00:00.000Z",
        cancelAtPeriodEnd: true,
      },
    },
  });
  assert.match(markup, /Team/);
  assert.match(markup, /Paid through/);
  assert.match(markup, /cancellation is scheduled/i);
  assert.match(markup, /Manage subscription/);
  assert.match(markup, /Refresh payment status/);
  assert.match(markup, /Continue to Forge/);
  assert.match(markup, /href="\/dashboard"/);
  assert.doesNotMatch(markup, /Subscribe|\$79|\$149|\$229/);
});

test("only canonical allowed status offers a route back to Forge", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  assert.doesNotMatch(renderView(module), /Continue to Forge/);

  const preCutoff = renderView(module, {
    state: {
      kind: "ready",
      status: { ...baseStatus, allowed: true, reason: "trial" },
    },
  });
  assert.match(preCutoff, /Continue to Forge/);
});

test("refreshing denied billing to canonical allowed status reveals Continue to Forge", async (t) => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === "/api/forge-billing/status") {
      return Response.json(baseStatus);
    }
    if (url === "/api/forge-billing/refresh") {
      return Response.json({
        ...baseStatus,
        allowed: true,
        reason: "paid",
        plan: "team",
        interval: "month",
        seatLimit: 8,
        subscriptionStatus: "active",
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const renderer = hookRenderer();
  t.after(() => renderer.dispose());
  renderer.render(module.default, { standalone: true });
  renderer.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));

  let root = renderer.render(module.default, { standalone: true });
  let view = elements(
    root,
    (element: React.ReactElement) => element.type === module.ForgeBillingView,
  )[0]!;
  assert.equal(view.props.state.status.allowed, false);
  assert.doesNotMatch(renderToStaticMarkup(view), /Continue to Forge/);

  view.props.onRefresh();
  await new Promise((resolve) => setImmediate(resolve));
  root = renderer.render(module.default, { standalone: true });
  view = elements(
    root,
    (element: React.ReactElement) => element.type === module.ForgeBillingView,
  )[0]!;
  assert.equal(view.props.state.status.allowed, true);
  assert.match(renderToStaticMarkup(view), /Continue to Forge/);
  assert.deepEqual(calls, [
    "/api/forge-billing/status",
    "/api/forge-billing/refresh",
  ]);
});

test("pending actions disable competing controls and never claim access before refresh", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  const markup = renderView(module, {
    interval: "month",
    pending: "checkout",
  });
  assert.match(markup, /Opening secure checkout/);
  assert.doesNotMatch(markup, /Payment complete|Access restored|Subscription active/);

  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    fetchCalls.push({ url: String(input), init });
    return Response.json({ url: "https://checkout.stripe.test/session" });
  };
  const url = await module.createForgeCheckout(fetcher, "team", "month");
  assert.equal(url, "https://checkout.stripe.test/session");
  assert.deepEqual(fetchCalls.map((call) => call.url), [
    "/api/forge-billing/checkout",
  ]);
  assert.deepEqual(JSON.parse(String(fetchCalls[0].init?.body)), {
    plan: "team",
    interval: "month",
  });
});

test("typed status errors distinguish stale auth from retryable infrastructure failure", async () => {
  const module = (await loadCustomerModule(
    "components/billing/ForgeBilling.tsx",
  )) as BillingModule;
  for (const [status, message] of [
    [401, "Unauthorized"],
    [503, "Billing is temporarily unavailable."],
  ] as const) {
    await assert.rejects(
      () =>
        module.loadForgeBillingStatus(async () =>
          Response.json({ error: message }, { status }),
        ),
      (error: unknown) =>
        error instanceof module.ForgeBillingRequestError &&
        error.status === status &&
        error.message === message,
    );
  }
});

test("last-administrator deletion recovery promotes only the selected existing employee", async () => {
  const module = await loadCustomerModule(
    "components/account/AccountDeletionSection.tsx",
  );
  const markup = renderToStaticMarkup(
    React.createElement(module.AccountDeletionRecovery, {
      billingEnabled: true,
      companyName: "Forge Test",
      eligibleStaff: [
        { id: 8, name: "Ada Lovelace" },
        { id: 9, name: "Grace Hopper" },
      ],
      pendingStaffId: null,
      error: null,
      onPromote() {},
      onRetry() {},
    }),
  );
  assert.match(markup, /Ada Lovelace/);
  assert.match(markup, /Grace Hopper/);
  assert.match(markup, /Promote and continue/);
  assert.doesNotMatch(markup, /Go to Employees/);

  const calls: Array<{ input: string; init?: RequestInit }> = [];
  await module.promoteDeletionAdministrator(
    9,
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return Response.json({
        ok: true,
        administrator: { id: 9, name: "Grace Hopper" },
      });
    },
  );
  assert.equal(calls[0].input, "/api/forge-billing/administrators");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { staffId: 9 });
});

test("disabled billing preserves last-administrator Employees recovery", async () => {
  const module = await loadCustomerModule(
    "components/account/AccountDeletionSection.tsx",
  );
  const markup = renderToStaticMarkup(
    React.createElement(module.AccountDeletionRecovery, {
      billingEnabled: false,
      companyName: "Forge Test",
      eligibleStaff: [{ id: 8, name: "Ada Lovelace" }],
      pendingStaffId: null,
      error: null,
      onPromote() {},
      onRetry() {},
    }),
  );

  assert.match(markup, /Go to Employees/);
  assert.match(markup, /href="\/employees"/);
  assert.doesNotMatch(markup, /Promote and continue|Ada Lovelace|Retry/);
});

test("enabled public copy offers a 14-day company trial without a shared deadline", async () => {
  const module = await loadCustomerModule("lib/forge-billing/copy.ts");
  const dormant = module.forgePublicAccessCopy(false);
  assert.equal(dormant.signup, "Start your free trial. No credit card required.");

  const enabled = module.forgePublicAccessCopy(true);
  for (const copy of Object.values(enabled)) assert.match(String(copy), /14-day/);
  assert.match(enabled.signup, /company/i);
  assert.doesNotMatch(`${enabled.signup} ${enabled.marketing}`, /September 26|shared access|cutoff/i);
});

test("disabled Settings billing preserves the existing placeholder", async () => {
  const module = await loadCustomerModule("components/SettingsTabs.tsx");
  const markup = renderToStaticMarkup(
    React.createElement(module.BillingPanel, { enabled: false }),
  );
  assert.match(markup, />Billing</);
  assert.match(markup, /Coming soon\./);
  assert.doesNotMatch(markup, /\$79|Subscribe|Company Billing/);
});

test("organization deletion warns that billing cancellation has no refund promise", async () => {
  const module = await loadCustomerModule(
    "components/account/AccountDeletionSection.tsx",
  );
  const preview = {
    scope: "organization" as const,
    companyName: "Forge Test",
    employeeCount: 1,
    adminCount: 1,
    blockedReason: null,
  };
  const message = module.accountDeletionScopeMessage(preview, true);
  assert.match(message, /permanently deletes the organization/i);
  assert.match(message, /subscription.*cancel/i);
  assert.match(message, /does not promise a refund or proration/i);

  const disabledMessage = module.accountDeletionScopeMessage(preview, false);
  assert.match(disabledMessage, /permanently deletes the organization/i);
  assert.doesNotMatch(disabledMessage, /subscription|refund|proration/i);
});
