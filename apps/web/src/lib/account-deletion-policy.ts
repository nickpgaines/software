export type AccountDeletionDecision =
  | { kind: "employee" }
  | { kind: "organization" }
  | { kind: "blocked"; reason: "final_admin" };

export type AdministrativeRemovalBlock =
  | "final_employee"
  | "final_admin"
  | null;

type EmployeeCounts = {
  employeeCount: number;
  adminCount: number;
};

function assertValidCounts({ employeeCount, adminCount }: EmployeeCounts) {
  if (
    !Number.isInteger(employeeCount) ||
    !Number.isInteger(adminCount) ||
    employeeCount < 1 ||
    adminCount < 0 ||
    adminCount > employeeCount
  ) {
    throw new RangeError("Invalid employee or administrator count");
  }
}

export function decideSelfDeletion({
  employeeCount,
  adminCount,
  actorIsAdmin,
}: EmployeeCounts & {
  actorIsAdmin: boolean;
}): AccountDeletionDecision {
  assertValidCounts({ employeeCount, adminCount });

  if (employeeCount === 1) return { kind: "organization" };
  if (actorIsAdmin && adminCount === 1) {
    return { kind: "blocked", reason: "final_admin" };
  }
  return { kind: "employee" };
}

export function getAdministrativeRemovalBlock({
  employeeCount,
  adminCount,
  targetIsAdmin,
}: EmployeeCounts & {
  targetIsAdmin: boolean;
}): AdministrativeRemovalBlock {
  assertValidCounts({ employeeCount, adminCount });

  if (employeeCount === 1) return "final_employee";
  if (targetIsAdmin && adminCount === 1) return "final_admin";
  return null;
}
