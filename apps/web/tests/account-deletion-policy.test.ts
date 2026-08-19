import assert from "node:assert/strict";
import test from "node:test";
import {
  decideSelfDeletion,
  getAdministrativeRemovalBlock,
} from "../src/lib/account-deletion-policy.ts";

test("deletes the organization when its last employee deletes their account", () => {
  assert.deepEqual(
    decideSelfDeletion({
      employeeCount: 1,
      adminCount: 1,
      actorIsAdmin: true,
    }),
    { kind: "organization" }
  );
});

test("blocks the final administrator from leaving other employees without an admin", () => {
  assert.deepEqual(
    decideSelfDeletion({
      employeeCount: 2,
      adminCount: 1,
      actorIsAdmin: true,
    }),
    { kind: "blocked", reason: "final_admin" }
  );
});

test("deletes only a non-admin employee when colleagues remain", () => {
  assert.deepEqual(
    decideSelfDeletion({
      employeeCount: 2,
      adminCount: 1,
      actorIsAdmin: false,
    }),
    { kind: "employee" }
  );
});

test("prevents administrative removal of the final employee", () => {
  assert.equal(
    getAdministrativeRemovalBlock({
      employeeCount: 1,
      adminCount: 1,
      targetIsAdmin: true,
    }),
    "final_employee"
  );
});

test("rejects a team count with no employee", () => {
  assert.throws(
    () =>
      decideSelfDeletion({
        employeeCount: 0,
        adminCount: 0,
        actorIsAdmin: false,
      }),
    RangeError
  );
});

test("rejects an administrator count larger than the team", () => {
  assert.throws(
    () =>
      decideSelfDeletion({
        employeeCount: 2,
        adminCount: 3,
        actorIsAdmin: true,
      }),
    RangeError
  );
});
