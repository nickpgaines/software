import assert from "node:assert/strict";
import test from "node:test";
import type { Db, Stmt } from "../src/lib/db.ts";
import { loadWidgetPermissions } from "../src/lib/widget-permissions.ts";

function permissionDb(input: {
  permissionLevel: string;
  customRoleId?: number | null;
  customPermissions?: string;
}) {
  const statements: { sql: string; args: unknown[] }[] = [];
  return {
    statements,
    db: {
      prepare(sql: string) {
        return {
          async get(...args: unknown[]) {
            statements.push({ sql, args });
            if (sql.includes("FROM staff")) {
              return {
                permission_level: input.permissionLevel,
                custom_role_id: input.customRoleId ?? null,
              };
            }
            if (sql.includes("FROM custom_roles")) {
              return { permissions: input.customPermissions ?? "[]" };
            }
            return undefined;
          },
          async all() {
            return [];
          },
          async run() {
            return { changes: 0, lastInsertRowid: 0 };
          },
        } as Stmt;
      },
      async exec() {},
      async transaction<T>(fn: (tx: Db) => Promise<T>) {
        return fn(this as Db);
      },
    } as Db,
  };
}

test("resolves current built-in permissions for the token staff and tenant", async () => {
  const { db, statements } = permissionDb({ permissionLevel: "admin" });
  const permissions = await loadWidgetPermissions(db, {
    tokenId: 1,
    companyId: 42,
    staffId: 9,
  });
  assert.equal(permissions.has("reports.view"), true);
  assert.equal(permissions.has("leaderboard.view_sales"), true);
  assert.deepEqual(statements[0].args, [9, 42]);
});

test("re-reads custom role permissions on every summary request", async () => {
  const { db, statements } = permissionDb({
    permissionLevel: "technician",
    customRoleId: 7,
    customPermissions: JSON.stringify(["leaderboard.view_sales"]),
  });
  const permissions = await loadWidgetPermissions(db, {
    tokenId: 1,
    companyId: 42,
    staffId: 9,
  });
  assert.deepEqual([...permissions], ["leaderboard.view_sales"]);
  assert.deepEqual(statements[1].args, [7, 42]);
});
