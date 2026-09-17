import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureNativeWidgetCredential,
  logoutForgeSession,
  type WidgetCredential,
} from "../src/lib/native-widget.ts";
import { nativeTerminal } from "../src/lib/native-terminal.ts";

// Exercise the real Capacitor proxy, not an ordinary object standing in for it.
// Returning that proxy directly from the async loader hangs Promise resolution.
test("real Capacitor plugin completes logout even when Terminal cleanup stalls", { timeout: 3_000 }, async (t) => {
  const globals = ["window", "webkit", "Capacitor"] as const;
  const original = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => {
    globals.forEach((key, index) => {
      if (original[index]) Object.defineProperty(globalThis, key, original[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  });

  const issued: WidgetCredential = {
    token: "test-widget-token",
    company_id: 17,
    staff_id: 23,
    expires_at: "2099-01-01T00:00:00.000Z",
  };
  let stored: WidgetCredential | null = null;
  const nativeCalls: string[] = [];
  const requests: string[] = [];
  const methods = ["getInstallation", "storeCredential", "credentialMetadata", "clearCredential", "refreshSnapshot"];
  Object.assign(globalThis, {
    window: globalThis,
    webkit: { messageHandlers: { bridge: {} } },
    Capacitor: {
      PluginHeaders: [{ name: "ForgeWidget", methods: methods.map((name) => ({ name, rtype: "promise" })) }, {name:"ForgeTerminal", methods:[{name:"reset",rtype:"promise"}]}],
      nativePromise: async (plugin: string, method: string, options?: WidgetCredential) => {
        if (plugin === "ForgeTerminal") { assert.equal(method,"reset"); return new Promise(()=>{}); }
        assert.equal(plugin, "ForgeWidget");
        nativeCalls.push(method);
        switch (method) {
          case "credentialMetadata": return { credential: stored };
          case "getInstallation": return { installation_id: "installation_123456" };
          case "storeCredential": stored = options!; return;
          case "clearCredential": stored = null; return;
          case "refreshSnapshot": return { refreshed: true };
          default: throw new Error(`Unexpected native method: ${method}`);
        }
      },
    },
  });
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = `${init?.method ?? "GET"} ${input}`;
    requests.push(request);
    switch (request) {
      case "GET /api/widget/token": return Response.json({ company_id: 17, staff_id: 23 });
      case "POST /api/widget/token":
        assert.deepEqual(JSON.parse(String(init?.body)), { installation_id: "installation_123456" });
        return Response.json(issued);
      case "DELETE /api/widget/token":
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-widget-token");
        return Response.json({ revoked: true });
      case "POST /api/logout": return Response.json({ success: true });
      default: throw new Error(`Unexpected request: ${request}`);
    }
  });

  assert.equal(await ensureNativeWidgetCredential(), true);
  assert.deepEqual(stored, issued);
  assert.deepEqual(nativeCalls, ["credentialMetadata", "getInstallation", "storeCredential", "refreshSnapshot"]);

  assert.equal(await ensureNativeWidgetCredential(), true);
  assert.deepEqual(nativeCalls.slice(4), ["credentialMetadata", "refreshSnapshot"]);
  const generation=nativeTerminal.generation;
  const logout=logoutForgeSession();
  assert.notEqual(nativeTerminal.generation,generation);
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(requests.includes("POST /api/logout"),"server logout starts before native cleanup returns");
  await logout;
  assert.equal(stored, null);
  assert.deepEqual(nativeCalls.slice(6), ["credentialMetadata", "clearCredential"]);
  assert.deepEqual(requests, [
    "GET /api/widget/token", "POST /api/widget/token", "GET /api/widget/token",
    "POST /api/logout", "DELETE /api/widget/token",
  ]);
});
