import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteTenantDataWithoutForeignKeyCascades,
  type TenantDeletionDb,
} from "../src/lib/tenant-deletion.ts";

test("deletes every known tenant table without a company foreign-key cascade", async () => {
  const statements: Array<{ sql: string; args: unknown[] }> = [];
  const db: TenantDeletionDb = {
    prepare(sql) {
      return {
        async run(...args: unknown[]) {
          statements.push({ sql, args });
          return { changes: 1, lastInsertRowid: 0 };
        },
      };
    },
  };

  await deleteTenantDataWithoutForeignKeyCascades(db, 42);

  assert.deepEqual(statements, [
    { sql: "DELETE FROM customer_reviews WHERE company_id = ?", args: [42] },
    { sql: "DELETE FROM custom_roles WHERE company_id = ?", args: [42] },
  ]);
});
