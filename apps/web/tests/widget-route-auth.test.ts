import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  handleWidgetRevocationRequest,
  handleWidgetSummaryRequest,
  isNativeWidgetRequest,
  isWidgetBearerRoute,
  readWidgetBearer,
  validateWidgetInstallationId,
} from "../src/lib/widget-http.ts";

test("middleware bypasses cookie auth only for bearer widget operations", () => {
  const token = "w".repeat(43);
  assert.equal(
    isWidgetBearerRoute(
      new Request("https://www.forgecrm.app/api/widget/summary", {
        headers: { authorization: `Bearer ${token}` },
      })
    ),
    true
  );
  assert.equal(
    isWidgetBearerRoute(
      new Request("https://www.forgecrm.app/api/widget/token", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      })
    ),
    true
  );
  assert.equal(
    isWidgetBearerRoute(
      new Request("https://www.forgecrm.app/api/widget/token", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    ),
    false
  );
  assert.equal(
    isWidgetBearerRoute(
      new Request("https://www.forgecrm.app/api/widget/summary")
    ),
    false
  );
});

test("accepts only a base64url bearer credential, never a cookie", () => {
  assert.equal(
    readWidgetBearer(
      new Request("https://www.forgecrm.app/api/widget/summary", {
        headers: { cookie: "crm_session=valid-looking-cookie" },
      })
    ),
    null
  );
  assert.equal(
    readWidgetBearer(
      new Request("https://www.forgecrm.app/api/widget/summary", {
        headers: { authorization: "Basic abc" },
      })
    ),
    null
  );
  const token = "a".repeat(43);
  assert.equal(
    readWidgetBearer(
      new Request("https://www.forgecrm.app/api/widget/summary", {
        headers: { authorization: `Bearer ${token}`, cookie: "crm_session=x" },
      })
    ),
    token
  );
});

test("summary passes only the authenticated widget principal to its builder", async () => {
  const token = "b".repeat(43);
  let builtFor: unknown = null;
  const response = await handleWidgetSummaryRequest(
    new Request("https://www.forgecrm.app/api/widget/summary", {
      headers: { authorization: `Bearer ${token}` },
    }),
    {
      authenticate: async (received) => {
        assert.equal(received, token);
        return { tokenId: 1, companyId: 42, staffId: 9 };
      },
      buildSummary: async (principal) => {
        builtFor = principal;
        return { version: 1, company_id: principal.companyId };
      },
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(builtFor, { tokenId: 1, companyId: 42, staffId: 9 });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("summary and revocation reject missing or invalid widget credentials", async () => {
  const deps = {
    authenticate: async () => null,
    buildSummary: async () => ({ should_not: "run" }),
  };
  assert.equal(
    (
      await handleWidgetSummaryRequest(
        new Request("https://www.forgecrm.app/api/widget/summary"),
        deps
      )
    ).status,
    401
  );

  const token = "c".repeat(43);
  assert.equal(
    (
      await handleWidgetRevocationRequest(
        new Request("https://www.forgecrm.app/api/widget/token", {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        }),
        { authenticate: async () => null, revoke: async () => true }
      )
    ).status,
    401
  );
});

test("normal job mutations remain session-authenticated", () => {
  const source = readFileSync(
    new URL("../src/app/api/jobs/[id]/status/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /getSessionContext\(\)/);
  assert.doesNotMatch(source, /authenticateWidgetToken|readWidgetBearer/);
});

test("token issuance requires the native user agent and a bounded installation id", () => {
  assert.equal(
    isNativeWidgetRequest(
      new Request("https://www.forgecrm.app/api/widget/token", {
        headers: { "user-agent": "Mozilla/5.0 ForgeNative/1" },
      })
    ),
    true
  );
  assert.equal(
    isNativeWidgetRequest(
      new Request("https://www.forgecrm.app/api/widget/token", {
        headers: { "user-agent": "Mozilla/5.0" },
      })
    ),
    false
  );
  assert.equal(
    validateWidgetInstallationId("123e4567-e89b-12d3-a456-426614174000"),
    "123e4567-e89b-12d3-a456-426614174000"
  );
  assert.equal(validateWidgetInstallationId("short"), null);
  assert.equal(validateWidgetInstallationId("x".repeat(201)), null);
  assert.equal(validateWidgetInstallationId("not valid spaces"), null);
});
