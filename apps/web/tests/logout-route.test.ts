import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

import type { Db, Stmt } from "../src/lib/db.ts";
import type { SessionContext } from "../src/lib/auth.ts";

const SESSION_COOKIE = "crm_session";

const harnessState: {
  sessionContext: SessionContext | null;
  database: Db | null;
} = {
  sessionContext: null,
  database: null,
};
(globalThis as typeof globalThis & { __logoutRouteHarness?: typeof harnessState })
  .__logoutRouteHarness = harnessState;

const harnessModuleUrl = `data:text/javascript,${encodeURIComponent(`
  export const SESSION_COOKIE = "crm_session";
  export async function getSessionContext() {
    return globalThis.__logoutRouteHarness.sessionContext;
  }
  export async function getDb() {
    return globalThis.__logoutRouteHarness.database;
  }
`)}`;

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/auth" || specifier === "@/lib/db") {
      return { url: harnessModuleUrl, shortCircuit: true };
    }
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        context
      );
    }
    return nextResolve(specifier, context);
  },
});

const { POST } = await import("../src/app/api/logout/route.ts");
hooks.deregister();

type TokenRow = {
  companyId: number;
  staffId: number;
  revoked: boolean;
};

function logoutDb(tokens: TokenRow[], error?: Error) {
  return {
    prepare(sql: string) {
      return {
        async run(...args: unknown[]) {
          if (error) throw error;
          assert.match(sql, /UPDATE widget_access_tokens/);
          const [companyId, staffId] = args as [number, number];
          let changes = 0;
          for (const token of tokens) {
            if (
              token.companyId === companyId &&
              token.staffId === staffId &&
              !token.revoked
            ) {
              token.revoked = true;
              changes += 1;
            }
          }
          return { changes, lastInsertRowid: 0 };
        },
      } as Stmt;
    },
  } as Db;
}

function cookieWasCleared(response: Response) {
  const cookie = response.headers.get("set-cookie") ?? "";
  return cookie.includes(`${SESSION_COOKIE}=`) && cookie.includes("Max-Age=0");
}

test("logout revokes all current staff widget tokens without affecting another staff member", async () => {
  const tokens: TokenRow[] = [
    { companyId: 42, staffId: 9, revoked: false },
    { companyId: 42, staffId: 9, revoked: false },
    { companyId: 42, staffId: 10, revoked: false },
    { companyId: 7, staffId: 9, revoked: false },
    { companyId: 42, staffId: 9, revoked: true },
  ];
  harnessState.sessionContext = {
    identity: "staff@example.com",
    staffId: 9,
    companyId: 42,
    isPlatformAdmin: false,
  };
  harnessState.database = logoutDb(tokens);

  const response = await POST();

  assert.equal(response.status, 200);
  assert.deepEqual(
    tokens.map(({ revoked }) => revoked),
    [true, true, false, false, true]
  );
  assert.equal(cookieWasCleared(response), true);
});

test("platform administrator logout succeeds without a staff-token revocation", async () => {
  harnessState.sessionContext = {
    identity: "admin",
    staffId: null,
    companyId: 1,
    isPlatformAdmin: true,
  };
  harnessState.database = {
    prepare() {
      throw new Error("platform logout must not access widget tokens");
    },
  } as Db;

  const response = await POST();

  assert.equal(response.status, 200);
  assert.equal(cookieWasCleared(response), true);
});

test("logout keeps the session cookie when durable widget revocation fails", async () => {
  harnessState.sessionContext = {
    identity: "staff@example.com",
    staffId: 9,
    companyId: 42,
    isPlatformAdmin: false,
  };
  harnessState.database = logoutDb([], new Error("database unavailable"));

  const response = await POST();

  assert.equal(response.status, 500);
  assert.equal(cookieWasCleared(response), false);
});
