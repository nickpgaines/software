import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error The project uses Node 20 types, which predate node:sqlite.
import { DatabaseSync } from "node:sqlite";

import type { Db } from "../src/lib/db.ts";
import { withSmsRegistrationLease } from "../src/lib/sms-registration-lease.ts";

type LeaseTestDb = Db & { close(): void };

function leaseDatabase(): LeaseTestDb {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE sms_registration_leases (
      company_id INTEGER PRIMARY KEY,
      lease_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  let transactionChain: Promise<void> = Promise.resolve();
  return {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        async get<T>(...args: unknown[]): Promise<T | undefined> {
          return statement.get(...args) as T | undefined;
        },
        async all<T>(...args: unknown[]): Promise<T[]> {
          return statement.all(...args) as T[];
        },
        async run(...args: unknown[]) {
          const result = statement.run(...args);
          return {
            lastInsertRowid: Number(result.lastInsertRowid),
            changes: Number(result.changes),
          };
        },
      };
    },
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    transaction<R>(work: (db: Db) => Promise<R>) {
      const run = transactionChain.then(() => work(this));
      transactionChain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    close() {
      sqlite.close();
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("lease lets only one concurrent caller work for a company", async () => {
  const db = leaseDatabase();
  const workStarted = deferred();
  const releaseWork = deferred();
  let workCount = 0;

  const first = withSmsRegistrationLease(db, 1, async () => {
    workCount++;
    workStarted.resolve();
    await releaseWork.promise;
    return "first";
  });
  await workStarted.promise;

  const second = await withSmsRegistrationLease(db, 1, async () => {
    workCount++;
    return "second";
  });

  assert.deepEqual(second, { acquired: false });
  assert.equal(workCount, 1);
  releaseWork.resolve();
  assert.deepEqual(await first, { acquired: true, value: "first" });
  db.close();
});

test("lease allows different companies to work concurrently", async () => {
  const db = leaseDatabase();
  const bothStarted = deferred();
  const releaseWork = deferred();
  const started = new Set<number>();

  const run = (companyId: number) =>
    withSmsRegistrationLease(db, companyId, async () => {
      started.add(companyId);
      if (started.size === 2) bothStarted.resolve();
      await releaseWork.promise;
      return companyId;
    });

  const first = run(1);
  const second = run(2);
  await bothStarted.promise;
  assert.deepEqual([...started].sort(), [1, 2]);
  releaseWork.resolve();
  assert.deepEqual(await Promise.all([first, second]), [
    { acquired: true, value: 1 },
    { acquired: true, value: 2 },
  ]);
  db.close();
});

test("lease release permits a later attempt", async () => {
  const db = leaseDatabase();

  assert.deepEqual(
    await withSmsRegistrationLease(db, 1, async () => "first"),
    { acquired: true, value: "first" }
  );
  assert.deepEqual(
    await withSmsRegistrationLease(db, 1, async () => "second"),
    { acquired: true, value: "second" }
  );
  db.close();
});

test("registration lease renews while provider work is still awaiting a response", async t => {
  const db = leaseDatabase(); t.after(() => db.close());
  t.mock.timers.enable({ apis: ["setInterval"] });
  const started = deferred();
  const release = deferred();
  const first = withSmsRegistrationLease(db, 1, async () => { started.resolve(); await release.promise; });
  await started.promise;
  await db.prepare("UPDATE sms_registration_leases SET expires_at=datetime('now','+1 minute') WHERE company_id=1").run();
  const before = (await db.prepare("SELECT expires_at FROM sms_registration_leases WHERE company_id=1").get<{ expires_at: string }>())!.expires_at;
  t.mock.timers.tick(60_000);
  await new Promise<void>(resolve => setImmediate(resolve));
  const after = (await db.prepare("SELECT expires_at FROM sms_registration_leases WHERE company_id=1").get<{ expires_at: string }>())!.expires_at;
  release.resolve();
  await first;
  assert.ok(after > before, "active provider work must extend its lease before expiry");
});

test("lease older than five minutes can be reclaimed", async () => {
  const db = leaseDatabase();
  await db.prepare(
    `INSERT INTO sms_registration_leases
       (company_id, lease_token, expires_at)
     VALUES (?, ?, datetime('now', '-6 minutes'))`
  ).run(1, "expired-owner");

  assert.deepEqual(
    await withSmsRegistrationLease(db, 1, async () => "reclaimed"),
    { acquired: true, value: "reclaimed" }
  );
  db.close();
});

test("expired lease owner cannot release the reclaiming owner's lease", async () => {
  const db = leaseDatabase();
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const secondStarted = deferred();
  const releaseSecond = deferred();

  const first = withSmsRegistrationLease(db, 1, async () => {
    firstStarted.resolve();
    await releaseFirst.promise;
  });
  await firstStarted.promise;
  await db.prepare(
    "UPDATE sms_registration_leases SET expires_at = datetime('now', '-6 minutes') WHERE company_id = ?"
  ).run(1);

  const second = withSmsRegistrationLease(db, 1, async () => {
    secondStarted.resolve();
    await releaseSecond.promise;
  });
  await secondStarted.promise;
  const reclaimingToken = (
    await db
      .prepare(
        "SELECT lease_token FROM sms_registration_leases WHERE company_id = ?"
      )
      .get<{ lease_token: string }>(1)
  )!.lease_token;

  releaseFirst.resolve();
  await first;
  assert.equal(
    (
      await db
        .prepare(
          "SELECT lease_token FROM sms_registration_leases WHERE company_id = ?"
        )
        .get<{ lease_token: string }>(1)
    )!.lease_token,
    reclaimingToken
  );

  releaseSecond.resolve();
  await second;
  db.close();
});
