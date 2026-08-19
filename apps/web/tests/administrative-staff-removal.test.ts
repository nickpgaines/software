import assert from "node:assert/strict";
import test from "node:test";
import {
  removeStaffWithSafeguards,
  type StaffRemovalDb,
} from "../src/lib/administrative-staff-removal.ts";

type TeamMember = { id: number; permission_level: "admin" | "technician" };

function createDb(members: TeamMember[]) {
  let transactionCalls = 0;
  let deleteCalls = 0;
  const db: StaffRemovalDb = {
    async transaction(fn) {
      transactionCalls++;
      return fn({
        prepare(sql) {
          return {
            async get(...args: unknown[]) {
              if (sql.includes("SELECT id, permission_level FROM staff")) {
                const id = Number(args[0]);
                return members.find((member) => member.id === id);
              }
              if (sql.includes("COUNT(*) AS employee_count")) {
                return {
                  employee_count: members.length,
                  admin_count: members.filter(
                    (member) => member.permission_level === "admin"
                  ).length,
                };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
            async run(...args: unknown[]) {
              if (!sql.startsWith("DELETE FROM staff")) {
                throw new Error(`Unexpected write: ${sql}`);
              }
              deleteCalls++;
              const id = Number(args[0]);
              const index = members.findIndex((member) => member.id === id);
              if (index >= 0) members.splice(index, 1);
              return { changes: index >= 0 ? 1 : 0, lastInsertRowid: 0 };
            },
          };
        },
      } as never);
    },
  };
  return {
    db,
    members,
    get transactionCalls() {
      return transactionCalls;
    },
    get deleteCalls() {
      return deleteCalls;
    },
  };
}

test("requires self-deletion to use the reauthenticated account endpoint", async () => {
  const fixture = createDb([
    { id: 1, permission_level: "admin" },
    { id: 2, permission_level: "technician" },
  ]);

  const result = await removeStaffWithSafeguards({
    db: fixture.db,
    companyId: 7,
    actorStaffId: 1,
    targetStaffId: 1,
  });

  assert.deepEqual(result, { kind: "self_deletion" });
  assert.equal(fixture.transactionCalls, 0);
  assert.equal(fixture.deleteCalls, 0);
  assert.equal(fixture.members.length, 2);
});

test("runs the final-admin guard and deletion in one transaction", async () => {
  const fixture = createDb([
    { id: 1, permission_level: "admin" },
    { id: 2, permission_level: "admin" },
    { id: 3, permission_level: "technician" },
  ]);

  const result = await removeStaffWithSafeguards({
    db: fixture.db,
    companyId: 7,
    actorStaffId: 1,
    targetStaffId: 2,
  });

  assert.deepEqual(result, { kind: "deleted" });
  assert.equal(fixture.transactionCalls, 1);
  assert.equal(fixture.deleteCalls, 1);
  assert.deepEqual(fixture.members, [
    { id: 1, permission_level: "admin" },
    { id: 3, permission_level: "technician" },
  ]);
});

test("does not delete the sole administrator", async () => {
  const fixture = createDb([
    { id: 1, permission_level: "admin" },
    { id: 2, permission_level: "technician" },
  ]);

  const result = await removeStaffWithSafeguards({
    db: fixture.db,
    companyId: 7,
    actorStaffId: 2,
    targetStaffId: 1,
  });

  assert.deepEqual(result, { kind: "blocked", reason: "final_admin" });
  assert.equal(fixture.transactionCalls, 1);
  assert.equal(fixture.deleteCalls, 0);
  assert.equal(fixture.members.length, 2);
});
