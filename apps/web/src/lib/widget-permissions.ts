import type { Db } from "./db.ts";
import {
  resolvePermissions,
  type Permission,
} from "./permissions.ts";
import type { WidgetPrincipal } from "./widget-auth.ts";

export async function loadWidgetPermissions(
  db: Pick<Db, "prepare">,
  principal: WidgetPrincipal
): Promise<Set<Permission>> {
  const staff = await db
    .prepare(
      `SELECT permission_level, custom_role_id
         FROM staff
        WHERE id = ? AND company_id = ?
        LIMIT 1`
    )
    .get<{
      permission_level: string | null;
      custom_role_id: number | null;
    }>(principal.staffId, principal.companyId);
  if (!staff) return new Set();

  let customPermissions: Permission[] | null = null;
  if (staff.custom_role_id !== null) {
    const customRole = await db
      .prepare(
        `SELECT permissions
           FROM custom_roles
          WHERE id = ? AND company_id = ?
          LIMIT 1`
      )
      .get<{ permissions: string }>(
        staff.custom_role_id,
        principal.companyId
      );
    if (customRole) {
      try {
        const parsed = JSON.parse(customRole.permissions) as unknown;
        customPermissions = Array.isArray(parsed)
          ? (parsed.filter((value) => typeof value === "string") as Permission[])
          : [];
      } catch {
        customPermissions = [];
      }
    }
  }
  return resolvePermissions(staff.permission_level, customPermissions);
}
