import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Db, Stmt } from "../src/lib/db.ts";
import * as widgetAuth from "../src/lib/widget-auth.ts";

const {
  authenticateWidgetToken,
  hashWidgetSecret,
  issueWidgetToken,
  revokeWidgetToken,
} = widgetAuth;

function authDb(options?: {
  principal?: { id: number; company_id: number; staff_id: number };
  changes?: number;
}) {
  const statements: { sql: string; args: unknown[]; kind: "get" | "run" }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        async get(...args: unknown[]) {
          statements.push({ sql, args, kind: "get" });
          return options?.principal;
        },
        async all() {
          return [];
        },
        async run(...args: unknown[]) {
          statements.push({ sql, args, kind: "run" });
          return {
            changes: options?.changes ?? 1,
            lastInsertRowid: 73,
          };
        },
      } as Stmt;
    },
    async exec() {},
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(this as Db);
    },
  } as Db;
  return { db, statements };
}

test("issues an opaque token while storing only hashes", async () => {
  const { db, statements } = authDb();
  const now = new Date("2026-08-22T18:00:00.000Z");
  const issued = await issueWidgetToken(db, {
    companyId: 42,
    staffId: 9,
    installationId: "device-installation-secret",
    now,
  });

  assert.match(issued.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(issued.companyId, 42);
  assert.equal(issued.staffId, 9);
  assert.equal(issued.expiresAt, "2027-02-18T18:00:00.000Z");
  const insert = statements.find(({ sql }) =>
    sql.includes("INSERT INTO widget_access_tokens")
  );
  assert.ok(insert);
  assert.ok(insert.args.includes(hashWidgetSecret(issued.token)));
  assert.ok(insert.args.includes(hashWidgetSecret("device-installation-secret")));
  assert.equal(insert.args.includes(issued.token), false);
  assert.equal(insert.args.includes("device-installation-secret"), false);
  assert.match(insert.sql, /FROM staff WHERE id = \? AND company_id = \?/);
});

test("refuses to issue a token when the staff member is outside the tenant", async () => {
  const { db } = authDb({ changes: 0 });
  await assert.rejects(
    issueWidgetToken(db, {
      companyId: 42,
      staffId: 999,
      installationId: "device-installation-secret",
      now: new Date("2026-08-22T18:00:00.000Z"),
    }),
    /staff member is not active in this company/i
  );
});

test("authenticates only an active scoped principal and updates last use", async () => {
  const { db, statements } = authDb({
    principal: { id: 73, company_id: 42, staff_id: 9 },
  });
  const principal = await authenticateWidgetToken(
    db,
    "opaque-token",
    new Date("2026-08-22T18:00:00.000Z")
  );

  assert.deepEqual(principal, { tokenId: 73, companyId: 42, staffId: 9 });
  const select = statements.find(({ kind }) => kind === "get")!;
  assert.match(select.sql, /JOIN staff s/);
  assert.match(select.sql, /s\.company_id = wat\.company_id/);
  assert.match(select.sql, /JOIN company c/);
  assert.match(select.sql, /c\.access_status = 'active'/);
  assert.match(select.sql, /wat\.expires_at > \?/);
  assert.match(select.sql, /wat\.scope = 'widget:read'/);
  assert.equal(
    statements.some(({ sql }) => sql.includes("SET last_used_at = ?")),
    true
  );
});

test("rejects an invalid principal and revokes only the matching hash", async () => {
  const invalid = authDb();
  assert.equal(
    await authenticateWidgetToken(
      invalid.db,
      "invalid",
      new Date("2026-08-22T18:00:00.000Z")
    ),
    null
  );

  const revoked = authDb({ changes: 1 });
  assert.equal(
    await revokeWidgetToken(
      revoked.db,
      "opaque-token",
      new Date("2026-08-22T18:00:00.000Z")
    ),
    true
  );
  const update = revoked.statements.find(({ kind }) => kind === "run")!;
  assert.match(update.sql, /WHERE token_hash = \? AND revoked_at IS NULL/);
  assert.ok(update.args.includes(hashWidgetSecret("opaque-token")));
  assert.equal(update.args.includes("opaque-token"), false);
});

test("logout revokes every active widget token for only the current tenant staff", async () => {
  const { db, statements } = authDb({ changes: 2 });
  const revokeWidgetTokensForStaff = (
    widgetAuth as typeof widgetAuth & {
      revokeWidgetTokensForStaff?: (
        db: Db,
        companyId: number,
        staffId: number
      ) => Promise<number>;
    }
  ).revokeWidgetTokensForStaff;

  assert.equal(typeof revokeWidgetTokensForStaff, "function");
  assert.equal(await revokeWidgetTokensForStaff!(db, 42, 9), 2);

  const update = statements.find(({ kind }) => kind === "run")!;
  assert.match(update.sql, /UPDATE widget_access_tokens/);
  assert.match(update.sql, /SET revoked_at = datetime\('now'\)/);
  assert.match(update.sql, /company_id = \?/);
  assert.match(update.sql, /staff_id = \?/);
  assert.match(update.sql, /revoked_at IS NULL/);
  assert.deepEqual(update.args, [42, 9]);
});

test("schema creates tenant and staff cascading widget credentials", () => {
  const source = readFileSync(
    new URL("../src/lib/db.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /const SCHEMA_VERSION = 20/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS widget_access_tokens/);
  assert.match(
    source,
    /company_id INTEGER NOT NULL REFERENCES company\(id\) ON DELETE CASCADE/
  );
  assert.match(
    source,
    /staff_id INTEGER NOT NULL REFERENCES staff\(id\) ON DELETE CASCADE/
  );
});
