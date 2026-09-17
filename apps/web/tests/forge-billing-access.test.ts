import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { hashPassword } from "../src/lib/password.ts";
import type { Db } from "../src/lib/db.ts";
import {
  fixture,
  loadTask2Modules,
  provider,
  setAfterNextTransactionCommit,
  setMcpPrincipal,
  setSession,
  setWidgetPrincipal,
  toolCalls,
} from "./helpers/forge-billing-access-harness.mjs";

const modules = await loadTask2Modules();

function sessionCookie(
  identity = "ada@example.com",
  staffId = 7,
  companyId = 1
) {
  const payload = `${identity}:${Date.now()}:${staffId}:${companyId}`;
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET || "test-secret")
    .update(payload)
    .digest("hex");
  return `${encoded}.${signature}`;
}

function middlewareRequest(path: string, method = "GET", headers = {}) {
  return new NextRequest(`https://attacker-controlled.test${path}`, {
    method,
    headers: {
      cookie: `crm_session=${sessionCookie()}`,
      host: "attacker-controlled.test",
      ...headers,
    },
  });
}

async function setup(t: test.TestContext) {
  const state = fixture();
  t.after(state.close);
  await modules.schema.installForgeBillingSchema(state.db);
  process.env.SESSION_SECRET = "test-secret";
  return state;
}

test("disabled rollout never delegates, redirects, reads billing state, or needs provider config", async (t) => {
  await setup(t);
  process.env.FORGE_BILLING_ENABLED = "false";
  delete process.env.FORGE_BILLING_SITE_ORIGIN;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("access endpoint must not be called while disabled");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await modules.middleware.middleware(
    middlewareRequest("/dashboard")
  );
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(calls, 0);
});

test("unpaid access blocks APIs with 402 and pages at the fixed trusted billing origin", async (t) => {
  await setup(t);
  process.env.FORGE_BILLING_SITE_ORIGIN = "https://trusted.forge.test";
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return Response.json({ allowed: false, reason: "subscription_required" });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const api = await modules.middleware.middleware(
    middlewareRequest("/api/jobs", "GET", {
      "x-forge-internal": "allow",
      "x-forwarded-host": "forged.example",
    })
  );
  assert.equal(api.status, 402);
  assert.deepEqual(await api.json(), {
    error: "subscription_required",
    reason: "subscription_required",
  });

  const page = await modules.middleware.middleware(
    middlewareRequest("/dashboard", "GET", {
      "x-forge-internal": "allow",
      "x-forwarded-host": "forged.example",
    })
  );
  assert.equal(
    page.headers.get("location"),
    "https://trusted.forge.test/billing"
  );
  assert.deepEqual(urls, [
    "https://trusted.forge.test/api/forge-billing/access",
    "https://trusted.forge.test/api/forge-billing/access",
  ]);
});

test("safe recovery routes bypass entitlement with exact boundary matching", async (t) => {
  await setup(t);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ allowed: false, reason: "subscription_required" });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const safe: Array<[string, string]> = [
    ["GET", "/billing"],
    ["GET", "/api/forge-billing/status"],
    ["GET", "/api/me"],
    ["POST", "/api/logout"],
    ["DELETE", "/api/account/deletion"],
    ["GET", "/api/stripe/terminal/attempts"],
    ["POST", "/api/stripe/terminal/attempts/attempt_1/reconcile"],
    ["POST", "/api/stripe/terminal/attempts/attempt_1/cancel"],
    ["POST", "/api/jobs/12/payments/stripe-confirm"],
  ];
  for (const [method, path] of safe) {
    const headers = ["POST", "PUT", "PATCH", "DELETE"].includes(method)
      ? { origin: "https://attacker-controlled.test" }
      : {};
    const response = await modules.middleware.middleware(
      middlewareRequest(path, method, headers)
    );
    assert.equal(response.headers.get("x-middleware-next"), "1", path);
  }
  assert.equal(calls, 0);

  for (const [method, path] of [
    ["POST", "/api/stripe/terminal/attempts"],
    ["POST", "/api/jobs/12/payments/stripe-intent"],
    ["POST", "/api/forge-billing-status"],
  ]) {
    const response = await modules.middleware.middleware(
      middlewareRequest(path, method, {
        origin: "https://attacker-controlled.test",
      })
    );
    assert.equal(response.status, 402, path);
  }
});

test("authentication and CSRF run before entitlement; stale tenant sessions cannot authorize", async (t) => {
  await setup(t);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ error: "unauthorized" }, { status: 401 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const invalid = await modules.middleware.middleware(
    new NextRequest("https://forge.test/api/jobs")
  );
  assert.equal(invalid.status, 401);
  assert.equal(calls, 0);

  const csrf = await modules.middleware.middleware(
    middlewareRequest("/api/jobs", "POST", { origin: "https://evil.test" })
  );
  assert.equal(csrf.status, 403);
  assert.equal(calls, 0);

  const staleApi = await modules.middleware.middleware(
    middlewareRequest("/api/jobs")
  );
  assert.equal(staleApi.status, 401);
  assert.equal(calls, 1);

  globalThis.fetch = async () =>
    Response.json({ error: "unavailable" }, { status: 503 });
  const unavailablePage = await modules.middleware.middleware(
    middlewareRequest("/dashboard")
  );
  assert.equal(unavailablePage.status, 503);
  assert.equal(unavailablePage.headers.get("location"), null);
});

test("access endpoint authenticates directly, ignores caller tenant data, and is uncached", async (t) => {
  await setup(t);
  const request = new Request(
    "https://forge.test/api/forge-billing/access?companyId=2",
    { headers: { "x-company-id": "2", "x-forge-internal": "allowed" } }
  );
  const response = await modules.accessRoute.GET(request);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    allowed: false,
    reason: "subscription_required",
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");

  setSession(null);
  assert.equal((await modules.accessRoute.GET(request)).status, 401);
});

test("platform administrators remain allowed without tenant billing entitlement", async (t) => {
  await setup(t);
  setSession({
    companyId: 1,
    staffId: null,
    identity: "admin",
    isPlatformAdmin: true,
  });
  assert.deepEqual(await modules.access.getSessionBillingAccess(), {
    allowed: true,
    reason: "platform_admin",
  });
});

test("widget summary and MCP execution enforce company entitlement without blocking revocation or OAuth", async (t) => {
  await setup(t);
  const token = "w".repeat(43);
  const widget = await modules.widgetRoute.GET(
    new Request("https://forge.test/api/widget/summary", {
      headers: { authorization: `Bearer ${token}` },
    })
  );
  assert.equal(widget.status, 402);
  assert.equal((await widget.json()).reason, "subscription_required");

  const mcp = await modules.mcpRoute.POST(
    new Request("https://mcp.test/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer mcp-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_jobs", arguments: {} },
      }),
    })
  );
  const mcpBody = await mcp.json();
  assert.equal(mcpBody.result.isError, true);
  assert.match(mcpBody.result.content[0].text, /subscription/i);
  assert.deepEqual(toolCalls, []);

  process.env.FORGE_BILLING_ENABLED = "false";
  const dormantMcp = await modules.mcpRoute.POST(
    new Request("https://mcp.test/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer mcp-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list_jobs", arguments: {} },
      }),
    })
  );
  assert.equal((await dormantMcp.json()).result.isError, undefined);
  assert.deepEqual(toolCalls, ["list_jobs"]);

  assert.equal(
    modules.middleware.isForgeBillingSafePath(
      "/api/widget/token",
      "DELETE"
    ),
    true
  );
  assert.equal(
    modules.middleware.isPublicForgeBillingPath(
      "/api/forge-billing/webhook",
      "POST"
    ),
    true
  );
  assert.equal(
    modules.middleware.isPublicForgeBillingPath(
      "/api/forge-billing/webhook/forged",
      "POST"
    ),
    false
  );
});

test("staff insertion atomically enforces paid seat limits on both insert paths", async (t) => {
  const { db } = await setup(t);
  await db.prepare("DELETE FROM staff WHERE id = 8").run();
  await db
    .prepare(
      `INSERT INTO forge_billing_accounts
        (company_id,account_id,livemode,customer_key,seat_limit,subscription_status,paid_through)
       VALUES(1,'acct_platform',0,'key_1',1,'active','2099-01-01T00:00:00.000Z')`
    )
    .run();

  const legacy = await modules.staffRoute.POST(
    new Request("https://forge.test/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Extra Tech", role: "technician" }),
    })
  );
  assert.equal(legacy.status, 409);

  const normal = await modules.staffRoute.POST(
    new Request("https://forge.test/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        first_name: "Extra",
        last_name: "Tech",
        email: "extra@example.com",
        password: "secret",
        permission_level: "technician",
      }),
    })
  );
  assert.equal(normal.status, 409);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM staff WHERE company_id=1").get())
      ?.n,
    1
  );
});

test("deletion tombstone blocks staff insertion even with rollout disabled", async (t) => {
  const { db } = await setup(t);
  process.env.FORGE_BILLING_ENABLED = "false";
  await db
    .prepare(
      `INSERT INTO forge_billing_accounts
        (company_id,account_id,livemode,customer_key,deleting)
       VALUES(1,'',0,'deleting_1',1)`
    )
    .run();
  const response = await modules.staffRoute.POST(
    new Request("https://forge.test/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Too Late", role: "technician" }),
    })
  );
  assert.equal(response.status, 409);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM staff WHERE name='Too Late'").get())
      ?.n,
    0
  );
});

test("a live Checkout reservation prevents a concurrent insert from exceeding the selected plan", async (t) => {
  const { db } = await setup(t);
  await db.prepare("DELETE FROM staff WHERE id = 8").run();
  await db
    .prepare(
      `INSERT INTO forge_billing_checkout
        (company_id,reservation_id,plan,interval,price_id,status)
       VALUES(1,'reservation_solo','solo','month','price_solo_month','open')`
    )
    .run();
  const response = await modules.staffRoute.POST(
    new Request("https://forge.test/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Second Seat", role: "technician" }),
    })
  );
  assert.equal(response.status, 409);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM staff WHERE company_id=1").get())
      ?.n,
    1
  );
});

test("a terminal old subscription does not leave a stale seat cap", async (t) => {
  const { db } = await setup(t);
  await db
    .prepare(
      `INSERT INTO forge_billing_accounts
        (company_id,account_id,livemode,customer_key,seat_limit,subscription_status)
       VALUES(1,'acct_platform',0,'old_subscription',1,'canceled')`
    )
    .run();
  const response = await modules.staffRoute.POST(
    new Request("https://forge.test/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Replacement Seat", role: "technician" }),
    })
  );
  assert.equal(response.status, 201);
});

for (const terminalStatus of ["canceled", "incomplete_expired"]) {
  test(`a persisted completed Checkout releases its exact ${terminalStatus} subscription seat cap`, async (t) => {
    const { db } = await setup(t);
    await db.prepare("DELETE FROM staff WHERE id = 8").run();
    await db
      .prepare(
        `INSERT INTO forge_billing_accounts
          (company_id,account_id,livemode,customer_id,customer_key)
         VALUES(1,'acct_platform',0,'cus_company_1',?)`
      )
      .run(`terminal_${terminalStatus}`);
    await db
      .prepare(
        `INSERT INTO forge_billing_checkout
          (company_id,reservation_id,plan,interval,price_id,session_id,status)
         VALUES(1,'reservation_terminal','solo','month','price_solo_month','cs_terminal','complete')`
      )
      .run();
    provider.sessions.push({
      id: "cs_terminal",
      customer: "cus_company_1",
      livemode: false,
      status: "complete",
      subscription: "sub_terminal",
      metadata: { forge_reservation_id: "reservation_terminal" },
    });
    provider.subscriptions.push({
      id: "sub_terminal",
      customer: "cus_company_1",
      livemode: false,
      status: terminalStatus,
      items: {
        data: [{ quantity: 1, price: { id: "price_solo_month" } }],
      },
    });

    const response = await modules.staffRoute.POST(
      new Request("https://forge.test/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Post-cancellation Seat", role: "technician" }),
      })
    );
    assert.equal(response.status, 201);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM forge_billing_checkout").get())
        ?.n,
      0
    );
  });
}

test("a persisted completed Checkout keeps its seat cap when the exact subscription is unresolved", async (t) => {
  const { db } = await setup(t);
  await db.prepare("DELETE FROM staff WHERE id = 8").run();
  await db
    .prepare(
      `INSERT INTO forge_billing_accounts
        (company_id,account_id,livemode,customer_id,customer_key,subscription_id,subscription_status)
       VALUES(1,'acct_platform',0,'cus_company_1','unresolved_customer','sub_old','canceled')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO forge_billing_checkout
        (company_id,reservation_id,plan,interval,price_id,session_id,status)
       VALUES(1,'reservation_unresolved','solo','month','price_solo_month','cs_unresolved','complete')`
    )
    .run();
  provider.sessions.push({
    id: "cs_unresolved",
    customer: "cus_company_1",
    livemode: false,
    status: "complete",
    subscription: "sub_new_unresolved",
    metadata: { forge_reservation_id: "reservation_unresolved" },
  });

  const response = await modules.staffRoute.POST(
    new Request("https://forge.test/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Unsafe Seat", role: "technician" }),
    })
  );
  assert.equal(response.status, 503);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM forge_billing_checkout").get())
      ?.n,
    1
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM staff WHERE company_id=1").get())
      ?.n,
    1
  );
});

test("administrator recovery is tenant scoped, minimal, and atomically promotes an existing employee", async (t) => {
  const { db } = await setup(t);
  await db
    .prepare("INSERT INTO custom_roles(id,company_id,permissions) VALUES(1,1,'[]')")
    .run();
  await db.prepare("UPDATE staff SET custom_role_id=1 WHERE id=7").run();

  const listing = await modules.administratorsRoute.GET(
    new Request("https://forge.test/api/forge-billing/administrators")
  );
  assert.equal(listing.status, 200);
  assert.deepEqual(await listing.json(), {
    administrators: [{ id: 7, name: "Ada Admin" }],
    eligibleStaff: [{ id: 8, name: "Terry Tech" }],
  });

  const promoted = await modules.administratorsRoute.POST(
    new Request("https://forge.test/api/forge-billing/administrators", {
      method: "POST",
      headers: {
        origin: "https://forge.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ staffId: 8, companyId: 2, permission_level: "admin" }),
    })
  );
  assert.equal(promoted.status, 200);
  assert.deepEqual(await promoted.json(), {
    ok: true,
    administrator: { id: 8, name: "Terry Tech" },
  });
  assert.deepEqual(
    {
      ...(await db
        .prepare("SELECT permission_level,custom_role_id FROM staff WHERE id=8")
        .get()),
    },
    { permission_level: "admin", custom_role_id: null }
  );
  assert.equal(
    (await db.prepare("SELECT permission_level FROM staff WHERE id=20").get())
      ?.permission_level,
    "admin"
  );

  const crossTenant = await modules.administratorsRoute.POST(
    new Request("https://forge.test/api/forge-billing/administrators", {
      method: "POST",
      headers: {
        origin: "https://forge.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ staffId: 20 }),
    })
  );
  assert.equal(crossTenant.status, 404);
});

test("export requires settings access and excludes credential/provider/token columns", async (t) => {
  await setup(t);
  const exportRequest = new Request("https://forge.test/api/forge-billing/export");
  const response = await modules.exportRoute.GET(exportRequest);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-disposition") || "",
    /attachment; filename="forge-acme-heating-export-\d{4}-\d{2}-\d{2}\.json"/
  );
  const text = await response.text();
  const body = JSON.parse(text);
  assert.equal(body.company.name, "Acme Heating");
  assert.equal(body.customers[0].name, "Customer One");
  for (const forbidden of [
    "password_hash",
    "private_token",
    "stripe_account_id",
    "twilio_subaccount_sid",
    "stripe_payment_intent_id",
    "accept_token",
    "signature_data",
    "default_payment_method_id",
    "customer-secret",
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }

  setSession({
    companyId: 1,
    staffId: 8,
    identity: "terry@example.com",
    isPlatformAdmin: false,
  });
  assert.equal((await modules.exportRoute.GET(exportRequest)).status, 403);
});

test("provider cancellation finishes before company deletion and failures retain local data", async (t) => {
  const { db } = await setup(t);
  await db.prepare("DELETE FROM staff WHERE id=8").run();
  await db
    .prepare("UPDATE staff SET password_hash=? WHERE id=7")
    .run(hashPassword("correct horse"));
  await db
    .prepare(
      `INSERT INTO forge_billing_accounts
        (company_id,account_id,livemode,customer_id,customer_key,subscription_id,subscription_status)
       VALUES(1,'acct_platform',0,'cus_company_1','customer_key_1','sub_1','active')`
    )
    .run();
  provider.subscriptions.push({
    id: "sub_1",
    customer: "cus_company_1",
    livemode: false,
    status: "active",
  });

  const deletionRequest = () =>
    new Request("https://forge.test/api/account/deletion", {
      method: "DELETE",
      headers: {
        origin: "https://forge.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        password: "correct horse",
        confirmation: "DELETE",
        expected_scope: "organization",
      }),
    });

  const wrongPassword = await modules.deletionRoute.DELETE(
    new Request("https://forge.test/api/account/deletion", {
      method: "DELETE",
      headers: {
        origin: "https://forge.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        password: "wrong",
        confirmation: "DELETE",
        expected_scope: "organization",
      }),
    })
  );
  assert.equal(wrongPassword.status, 401);
  assert.equal(
    (await db.prepare("SELECT deleting FROM forge_billing_accounts WHERE company_id=1").get())
      ?.deleting,
    0
  );

  provider.fail = true;
  const originalError = console.error;
  t.after(() => {
    console.error = originalError;
  });
  console.error = () => {};
  const failed = await modules.deletionRoute.DELETE(deletionRequest());
  console.error = originalError;
  assert.equal(failed.status, 503);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM company WHERE id=1").get())?.n, 1);
  assert.equal(
    (await db.prepare("SELECT deleting FROM forge_billing_accounts WHERE company_id=1").get())
      ?.deleting,
    1
  );

  provider.fail = false;
  const deleted = await modules.deletionRoute.DELETE(deletionRequest());
  assert.equal(deleted.status, 200);
  assert.deepEqual(provider.cancelCalls, ["sub_1"]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM company WHERE id=1").get())?.n, 0);
});

test("organization deletion claims its guard in the validation transaction before staff can insert", async (t) => {
  const { db } = await setup(t);
  await db.prepare("DELETE FROM staff WHERE id=8").run();
  await db
    .prepare("UPDATE staff SET password_hash=? WHERE id=7")
    .run(hashPassword("correct horse"));
  await db
    .prepare(
      `INSERT INTO forge_billing_accounts
        (company_id,account_id,livemode,customer_id,customer_key,subscription_id,subscription_status)
       VALUES(1,'acct_platform',0,'cus_company_1','atomic_deletion','sub_atomic','active')`
    )
    .run();
  provider.subscriptions.push({
    id: "sub_atomic",
    customer: "cus_company_1",
    livemode: false,
    status: "active",
  });

  let staffStatus = 0;
  setAfterNextTransactionCommit(async (committedDb: Db) => {
    try {
      await modules.access.assertStaffInsertionAllowed(committedDb, 1);
      await committedDb
        .prepare(
          "INSERT INTO staff(company_id,name,first_name,permission_level) VALUES(1,'Racing Staff','Racing','technician')"
        )
        .run();
      staffStatus = 201;
    } catch {
      staffStatus = 409;
    }
  });

  const deletion = await modules.deletionRoute.DELETE(
    new Request("https://forge.test/api/account/deletion", {
      method: "DELETE",
      headers: {
        origin: "https://forge.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        password: "correct horse",
        confirmation: "DELETE",
        expected_scope: "organization",
      }),
    })
  );
  assert.equal(staffStatus, 409);
  assert.equal(deletion.status, 200);
  assert.deepEqual(provider.cancelCalls, ["sub_atomic"]);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM company WHERE id=1").get())?.n,
    0
  );
});
