import { getAdministrativeRemovalBlock } from "./account-deletion-policy.ts";

type RemovalTarget = {
  id: number;
  permission_level: "admin" | "salesperson" | "technician";
};

type RemovalCounts = {
  employee_count: number;
  admin_count: number | null;
};

type RemovalStatement = {
  get<T>(...args: unknown[]): Promise<T | undefined>;
  run(...args: unknown[]): Promise<{ changes: number }>;
};

export type StaffRemovalTransaction = {
  prepare(sql: string): RemovalStatement;
};

export type StaffRemovalDb = {
  transaction<R>(
    fn: (db: StaffRemovalTransaction) => Promise<R>
  ): Promise<R>;
};

export type StaffRemovalResult =
  | { kind: "deleted" }
  | { kind: "not_found" }
  | { kind: "self_deletion" }
  | { kind: "blocked"; reason: "final_employee" | "final_admin" };

export async function removeStaffWithSafeguards({
  db,
  companyId,
  actorStaffId,
  targetStaffId,
}: {
  db: StaffRemovalDb;
  companyId: number;
  actorStaffId: number | null;
  targetStaffId: number;
}): Promise<StaffRemovalResult> {
  if (actorStaffId === targetStaffId) return { kind: "self_deletion" };

  return db.transaction(async (tx) => {
    const target = await tx
      .prepare(
        "SELECT id, permission_level FROM staff WHERE id = ? AND company_id = ?"
      )
      .get<RemovalTarget>(targetStaffId, companyId);
    if (!target) return { kind: "not_found" };

    const counts = await tx
      .prepare(
        `SELECT
           COUNT(*) AS employee_count,
           SUM(CASE WHEN permission_level = 'admin' THEN 1 ELSE 0 END) AS admin_count
         FROM staff
         WHERE company_id = ?`
      )
      .get<RemovalCounts>(companyId);
    const block = getAdministrativeRemovalBlock({
      employeeCount: Number(counts?.employee_count ?? 0),
      adminCount: Number(counts?.admin_count ?? 0),
      targetIsAdmin: target.permission_level === "admin",
    });
    if (block) return { kind: "blocked", reason: block };

    const deleted = await tx
      .prepare("DELETE FROM staff WHERE id = ? AND company_id = ?")
      .run(targetStaffId, companyId);
    return deleted.changes === 1 ? { kind: "deleted" } : { kind: "not_found" };
  });
}
