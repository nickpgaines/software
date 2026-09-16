import assert from "node:assert/strict";
import test from "node:test";

import {
  NativeWidgetCredentialLifecycle,
  scheduleNativeWidgetCredentialRetry,
  widgetCredentialNeedsRefresh,
  type ForgeWidgetPlugin,
  type WidgetCredential,
} from "../src/lib/native-widget.ts";

const currentCredential: WidgetCredential = {
  token: "o".repeat(43),
  company_id: 1,
  staff_id: 2,
  expires_at: "2026-12-01T00:00:00.000Z",
};

function fakePlugin(initial: WidgetCredential | null) {
  let credential = initial;
  const stored: WidgetCredential[] = [];
  let cleared = 0;
  let refreshed = 0;
  const plugin: ForgeWidgetPlugin = {
    getInstallation: async () => ({ installation_id: "installation_123456" }),
    storeCredential: async (value) => {
      stored.push(value);
      credential = value;
    },
    credentialMetadata: async () => ({ credential }),
    clearCredential: async () => {
      cleared += 1;
      credential = null;
    },
    refreshSnapshot: async () => {
      refreshed += 1;
      return { refreshed: true };
    },
  };
  return {
    plugin,
    stored,
    get cleared() {
      return cleared;
    },
    get refreshed() {
      return refreshed;
    },
  };
}

test("refreshes a missing or nearly expired widget credential", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");
  assert.equal(widgetCredentialNeedsRefresh(null, now), true);
  assert.equal(
    widgetCredentialNeedsRefresh(
      { expires_at: "2026-09-20T12:00:00.000Z" },
      now
    ),
    true
  );
});

test("reuses a credential with more than thirty days remaining", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");
  assert.equal(
    widgetCredentialNeedsRefresh(
      { expires_at: "2026-09-22T12:00:01.000Z" },
      now
    ),
    false
  );
});

test("refreshes a credential with an invalid expiration", () => {
  assert.equal(widgetCredentialNeedsRefresh({ expires_at: "not-a-date" }), true);
});

test("replaces a credential that belongs to a previous company or employee", async () => {
  const native = fakePlugin(currentCredential);
  const requests: Array<{ url: string; method: string }> = [];
  const replacement: WidgetCredential = {
    token: "n".repeat(43),
    company_id: 8,
    staff_id: 9,
    expires_at: "2027-01-01T00:00:00.000Z",
  };
  const lifecycle = new NativeWidgetCredentialLifecycle(
    async () => native.plugin,
    async (input, init) => {
      const url = String(input);
      const method = init?.method || "GET";
      requests.push({ url, method });
      if (method === "GET") {
        return Response.json({ company_id: 8, staff_id: 9 });
      }
      if (method === "POST") return Response.json(replacement);
      return Response.json({ revoked: true });
    }
  );

  await lifecycle.ensure();

  assert.deepEqual(native.stored, [replacement]);
  assert.equal(native.cleared, 1);
  assert.equal(native.refreshed, 1);
  assert.deepEqual(
    requests.map(({ method }) => method),
    ["GET", "DELETE", "POST"]
  );
});

test("logout cannot leave behind a credential issued by an in-flight bootstrap", async () => {
  const native = fakePlugin(null);
  let releaseIssue!: (response: Response) => void;
  const issuedResponse = new Promise<Response>((resolve) => {
    releaseIssue = resolve;
  });
  const deletedTokens: string[] = [];
  const issued: WidgetCredential = {
    token: "r".repeat(43),
    company_id: 1,
    staff_id: 2,
    expires_at: "2027-01-01T00:00:00.000Z",
  };
  const lifecycle = new NativeWidgetCredentialLifecycle(
    async () => native.plugin,
    async (input, init) => {
      const method = init?.method || "GET";
      if (String(input) === "/api/logout") return Response.json({ ok: true });
      if (method === "GET") {
        return Response.json({ company_id: 1, staff_id: 2 });
      }
      if (method === "POST") return issuedResponse;
      const token = new Headers(init?.headers).get("authorization");
      if (token) deletedTokens.push(token);
      return Response.json({ revoked: true });
    }
  );

  const bootstrap = lifecycle.ensure();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const logout = lifecycle.logout();
  releaseIssue(Response.json(issued));
  await Promise.all([bootstrap, logout]);

  assert.deepEqual(native.stored, []);
  assert.ok(native.cleared >= 1);
  assert.deepEqual(deletedTokens, [`Bearer ${issued.token}`]);
});

test("logout completes and clears local data while bootstrap is stalled", async () => {
  const native = fakePlugin(currentCredential);
  const never = new Promise<Response>(() => undefined);
  let loggedOut = false;
  const lifecycle = new NativeWidgetCredentialLifecycle(
    async () => native.plugin,
    async (input) => {
      if (String(input) === "/api/logout") {
        loggedOut = true;
        return Response.json({ ok: true });
      }
      return never;
    },
    10
  );

  void lifecycle.ensure();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.race([
    lifecycle.logout(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("logout stalled behind bootstrap")), 100)
    ),
  ]);

  assert.equal(loggedOut, true);
  assert.ok(native.cleared >= 1);
});

test(
  "a stalled bootstrap times out so a later activation can retry",
  { timeout: 250 },
  async () => {
    const native = fakePlugin(null);
    const never = new Promise<Response>(() => undefined);
    let principalRequests = 0;
    const issued: WidgetCredential = {
      token: "t".repeat(43),
      company_id: 1,
      staff_id: 2,
      expires_at: "2027-01-01T00:00:00.000Z",
    };
    const lifecycle = new NativeWidgetCredentialLifecycle(
      async () => native.plugin,
      async (_input, init) => {
        const method = init?.method || "GET";
        if (method === "GET") {
          principalRequests += 1;
          if (principalRequests === 1) return never;
          return Response.json({ company_id: 1, staff_id: 2 });
        }
        if (method === "POST") return Response.json(issued);
        return Response.json({ revoked: true });
      },
      10
    );

    assert.equal(await lifecycle.ensure(), false);
    assert.equal(await lifecycle.ensure(), true);

    assert.equal(principalRequests, 2);
    assert.deepEqual(native.stored, [issued]);
    assert.equal(native.refreshed, 1);
  }
);

test(
  "a stalled response body times out so a later activation can retry",
  { timeout: 250 },
  async () => {
    const native = fakePlugin(null);
    let principalRequests = 0;
    const issued: WidgetCredential = {
      token: "b".repeat(43),
      company_id: 1,
      staff_id: 2,
      expires_at: "2027-01-01T00:00:00.000Z",
    };
    const stalledBody = new Response(
      new ReadableStream({ start() {} }),
      { headers: { "Content-Type": "application/json" } }
    );
    const lifecycle = new NativeWidgetCredentialLifecycle(
      async () => native.plugin,
      async (_input, init) => {
        const method = init?.method || "GET";
        if (method === "GET") {
          principalRequests += 1;
          if (principalRequests === 1) return stalledBody;
          return Response.json({ company_id: 1, staff_id: 2 });
        }
        if (method === "POST") return Response.json(issued);
        return Response.json({ revoked: true });
      },
      10
    );

    assert.equal(await lifecycle.ensure(), false);
    assert.equal(await lifecycle.ensure(), true);

    assert.equal(principalRequests, 2);
    assert.deepEqual(native.stored, [issued]);
  }
);

test(
  "an invalidated issue request cannot pin later activation on stalled revocation",
  { timeout: 300 },
  async () => {
    const native = fakePlugin(null);
    let releaseFirstIssue!: (response: Response) => void;
    const firstIssue = new Promise<Response>((resolve) => {
      releaseFirstIssue = resolve;
    });
    let postRequests = 0;
    const firstIssued: WidgetCredential = {
      token: "i".repeat(43),
      company_id: 1,
      staff_id: 2,
      expires_at: "2027-01-01T00:00:00.000Z",
    };
    const replacement: WidgetCredential = {
      ...firstIssued,
      token: "j".repeat(43),
    };
    const never = new Promise<Response>(() => undefined);
    const lifecycle = new NativeWidgetCredentialLifecycle(
      async () => native.plugin,
      async (input, init) => {
        if (String(input) === "/api/logout") {
          return Response.json({ ok: true });
        }
        const method = init?.method || "GET";
        if (method === "GET") {
          return Response.json({ company_id: 1, staff_id: 2 });
        }
        if (method === "POST") {
          postRequests += 1;
          return postRequests === 1 ? firstIssue : Response.json(replacement);
        }
        if (method === "DELETE") return never;
        throw new Error(`Unexpected request: ${method}`);
      },
      10
    );

    const invalidated = lifecycle.ensure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await lifecycle.logout();
    releaseFirstIssue(Response.json(firstIssued));

    assert.equal(await invalidated, false);
    assert.equal(await lifecycle.ensure(), true);
    assert.deepEqual(native.stored, [replacement]);
  }
);

test("a delayed retry waits for the original attempt before starting fresh", async () => {
  let releaseFirst!: (connected: boolean) => void;
  const firstAttempt = new Promise<boolean>((resolve) => {
    releaseFirst = resolve;
  });
  let attempts = 1;

  const cancel = scheduleNativeWidgetCredentialRetry(
    firstAttempt,
    async () => {
      attempts += 1;
      return true;
    },
    10
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(attempts, 1);
  releaseFirst(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(attempts, 2);
  cancel();
});

test("a stalled token revocation never delays local clearing or web logout", async () => {
  const native = fakePlugin(currentCredential);
  const never = new Promise<Response>(() => undefined);
  let loggedOut = false;
  const lifecycle = new NativeWidgetCredentialLifecycle(
    async () => native.plugin,
    async (input, init) => {
      if (String(input) === "/api/logout") {
        loggedOut = true;
        return Response.json({ ok: true });
      }
      if (init?.method === "DELETE") return never;
      return Response.json({ company_id: 1, staff_id: 2 });
    },
    10
  );

  await Promise.race([
    lifecycle.logout(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("logout stalled behind revocation")), 100)
    ),
  ]);

  assert.equal(loggedOut, true);
  assert.ok(native.cleared >= 1);
});

test("HTTP failure from authoritative server logout is propagated after best-effort cleanup", async () => {
  const native = fakePlugin(currentCredential);
  const lifecycle = new NativeWidgetCredentialLifecycle(
    async () => native.plugin,
    async (input) => {
      if (String(input) === "/api/logout") {
        return Response.json({ error: "Could not log out." }, { status: 500 });
      }
      return Response.json({ revoked: true });
    }
  );

  await assert.rejects(lifecycle.logout(), /could not log out/i);
  assert.ok(native.cleared >= 1);
});

test("network failure from authoritative server logout is propagated after best-effort cleanup", async () => {
  const native = fakePlugin(currentCredential);
  const lifecycle = new NativeWidgetCredentialLifecycle(
    async () => native.plugin,
    async (input) => {
      if (String(input) === "/api/logout") throw new Error("network offline");
      return Response.json({ revoked: true });
    }
  );

  await assert.rejects(lifecycle.logout(), /network offline/i);
  assert.ok(native.cleared >= 1);
});
