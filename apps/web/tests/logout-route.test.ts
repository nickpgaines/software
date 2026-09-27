import assert from "node:assert/strict";
import test from "node:test";

import type { Db, Stmt } from "../src/lib/db.ts";
import {
  loadLogoutRoute,
  SESSION_COOKIE,
  setLogoutRouteHarness,
} from "./helpers/logout-route-harness.mjs";

const { POST } = await loadLogoutRoute();

type TokenRow = {
  companyId: number;
  staffId: number;
  revoked: boolean;
};

function logoutDb(
  tokens: TokenRow[],
  options: { error?: Error; beforeRun?: () => Promise<void> } = {}
) {
  const db: Db = {
    prepare(sql: string) {
      return {
        async run(...args: unknown[]) {
          if (options.error) throw options.error;
          assert.match(sql, /UPDATE widget_access_tokens/);
          await options.beforeRun?.();
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
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(db);
    },
  };
  return db;
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
  let releaseRevocation!: () => void;
  let markRevocationStarted!: () => void;
  const revocationGate = new Promise<void>((resolve) => {
    releaseRevocation = resolve;
  });
  const revocationStarted = new Promise<void>((resolve) => {
    markRevocationStarted = resolve;
  });
  setLogoutRouteHarness({
    sessionContext: {
      identity: "staff@example.com",
      staffId: 9,
      companyId: 42,
      isPlatformAdmin: false,
    },
    database: logoutDb(tokens, {
      beforeRun: async () => {
        markRevocationStarted();
        await revocationGate;
      },
    }),
  });

  let logoutSettled = false;
  const responsePromise = POST().then((response: Response) => {
    logoutSettled = true;
    return response;
  });
  await revocationStarted;
  await Promise.resolve();
  assert.equal(logoutSettled, false);

  releaseRevocation();
  const response = await responsePromise;

  assert.equal(response.status, 200);
  assert.deepEqual(
    tokens.map(({ revoked }) => revoked),
    [true, true, false, false, true]
  );
  assert.equal(cookieWasCleared(response), true);
});

test("platform administrator logout succeeds without a staff-token revocation", async () => {
  const db: Db = {
    prepare() {
      throw new Error("platform logout must not access widget tokens");
    },
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(db);
    },
  };
  setLogoutRouteHarness({
    sessionContext: {
      identity: "admin",
      staffId: null,
      companyId: 1,
      isPlatformAdmin: true,
    },
    database: db,
  });

  const response = await POST();

  assert.equal(response.status, 200);
  assert.equal(cookieWasCleared(response), true);
});

test("logout keeps the session cookie when durable widget revocation fails", async () => {
  setLogoutRouteHarness({
    sessionContext: {
      identity: "staff@example.com",
      staffId: 9,
      companyId: 42,
      isPlatformAdmin: false,
    },
    database: logoutDb([], { error: new Error("database unavailable") }),
  });

  const response = await POST();

  assert.equal(response.status, 500);
  assert.equal(cookieWasCleared(response), false);
});
