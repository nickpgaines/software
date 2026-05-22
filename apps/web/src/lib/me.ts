import { getDb, syncReplica, type Staff, type CustomRole } from "@/lib/db";
import { getSessionContext, type SessionContext } from "@/lib/auth";
import {
  resolvePermissions,
  ALL_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

export type Me = {
  identity: string;
  is_admin_account: boolean;
  staff: Staff | null;
  custom_role: { id: number; name: string; color: string } | null;
  permissions: Permission[];
};

async function lookupStaff(ctx: SessionContext): Promise<Staff | undefined> {
  const db = await getDb();
  if (ctx.staffId != null) {
    const byId = (await db
      .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ? LIMIT 1")
      .get(ctx.staffId, ctx.companyId)) as Staff | undefined;
    if (byId) return byId;
  }
  return (await db
    .prepare(
      "SELECT * FROM staff WHERE LOWER(email) = ? AND company_id = ? ORDER BY id ASC LIMIT 1"
    )
    .get(ctx.identity.toLowerCase(), ctx.companyId)) as Staff | undefined;
}

export async function buildMe(ctx: SessionContext): Promise<Me> {
  if (ctx.isPlatformAdmin) {
    return {
      identity: ctx.identity,
      is_admin_account: true,
      staff: null,
      custom_role: null,
      permissions: [...ALL_PERMISSIONS],
    };
  }
  let staff = await lookupStaff(ctx);
  // If the row isn't visible yet, this instance's embedded replica is
  // probably stale (signup just happened on another instance, or this one
  // hasn't ticked its sync yet). Force a sync and try once more before
  // giving up — much better UX than rendering the email fallback.
  if (!staff && ctx.staffId != null) {
    await syncReplica();
    staff = await lookupStaff(ctx);
  }

  let customRole: { id: number; name: string; color: string } | null = null;
  let customPerms: Permission[] | null = null;
  if (staff?.custom_role_id) {
    const db = await getDb();
    const row = (await db
      .prepare(
        "SELECT * FROM custom_roles WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get(staff.custom_role_id, ctx.companyId)) as CustomRole | undefined;
    if (row) {
      customRole = { id: row.id, name: row.name, color: row.color };
      try {
        const parsed = JSON.parse(row.permissions) as unknown;
        if (Array.isArray(parsed)) {
          customPerms = parsed.filter(
            (p): p is Permission => typeof p === "string"
          ) as Permission[];
        }
      } catch {
        customPerms = [];
      }
    }
  }

  const perms = resolvePermissions(staff?.permission_level ?? null, customPerms);

  return {
    identity: ctx.identity,
    is_admin_account: false,
    staff: staff ?? null,
    custom_role: customRole,
    permissions: Array.from(perms),
  };
}

// Server-side helper for layouts / pages that want the current user
// without going through HTTP. Returns null when there's no session.
export async function loadMe(): Promise<Me | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  return buildMe(ctx);
}
