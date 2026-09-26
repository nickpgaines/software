import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-ignore Shared harness executes the production TSX and its real UI primitives.
import { elements, hookRenderer, loadCustomerModule, text } from "./helpers/customer-ui.mjs";

const browserState = globalThis as typeof globalThis & { __customerQuery?: string };
for (const scenario of ["unconfigured", "server error", "network error", "invalid response"]) {
test(`${scenario}: payment status offers retry and support without exposing server diagnostics`, async () => {
  const module = await loadCustomerModule("components/SettingsTabs.tsx");
  const originalFetch = globalThis.fetch;
  const host = hookRenderer();
  const panel = hookRenderer();
  browserState.__customerQuery = "tab=payments";
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    if (scenario === "unconfigured") return Response.json({ configured: false, oauth_configured: false, connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false });
    if (scenario === "network error") throw new Error("internal network diagnostic");
    if (scenario === "invalid response") return new Response("internal proxy diagnostic", { status: 502 });
    return Response.json({ error: "STRIPE_SECRET_KEY server diagnostic" }, { status: 503 });
  };
  try {
    const root = module.default({ username: "Fake admin", initialMe: { identity: "admin@example.com", is_admin_account: false, staff: null, permissions: ["settings.view_all"] }, connectorUrl: "" });
    const inner = root.props.children;
    const tree = host.render(inner.type, inner.props);
    const paymentElement = elements(tree, (node: ReactElement) => typeof node.type === "function" && node.type.name === "PaymentsPanel")[0];
    assert.ok(paymentElement, "Payments tab is rendered");
    panel.render(paymentElement.type);
    panel.flushEffects();
    await new Promise(resolve => setImmediate(resolve));
    const failed = panel.render(paymentElement.type);
    const html = renderToStaticMarkup(failed);
    assert.doesNotMatch(html, /STRIPE_SECRET_KEY|PUBLISHABLE_KEY|redeploy|platform keys|internal .* diagnostic/i);
    const retry = elements(failed, (node: ReactElement) => text(node) === "Try again" && typeof node.props.onClick === "function")[0];
    assert.ok(retry, "A failed status request can be retried");
    assert.match(html, /href="mailto:support@forgecrm.app"/);
    globalThis.fetch = async () => { requests++; return Response.json({ configured: true, connected: false, oauth_configured: true, charges_enabled: false, payouts_enabled: false, details_submitted: false }); };
    await retry.props.onClick();
    const recovered = renderToStaticMarkup(panel.render(paymentElement.type));
    assert.match(recovered, /Create new Stripe account/);
    assert.equal(requests, 2);

    // A later refresh must not leave a stale configured card and raw error visible.
    globalThis.fetch = async () => Response.json({ configured: true, connected: true, oauth_configured: true, charges_enabled: true, payouts_enabled: true, details_submitted: true });
    await retry.props.onClick();
    const connected = panel.render(paymentElement.type);
    const refresh = elements(connected, (node: ReactElement) => text(node) === "Refresh" && typeof node.props.onClick === "function")[0];
    assert.ok(refresh);
    globalThis.fetch = async () => { throw new Error("internal network diagnostic"); };
    await refresh.props.onClick();
    const refreshFailed = panel.render(paymentElement.type);
    assert.doesNotMatch(renderToStaticMarkup(refreshFailed), /internal network diagnostic/);
    assert.ok(elements(refreshFailed, (node: ReactElement) => text(node) === "Try again" && typeof node.props.onClick === "function")[0]);
  } finally {
    globalThis.fetch = originalFetch;
    delete browserState.__customerQuery;
    host.dispose(); panel.dispose();
  }
});
}
