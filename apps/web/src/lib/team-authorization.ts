import { NextResponse } from 'next/server';
import { getSessionContext, type SessionContext } from '@/lib/auth';
import { getDb, type Db, type Staff } from '@/lib/db';
import { ALL_PERMISSIONS, isBuiltInRole, resolvePermissions, type Permission } from '@/lib/permissions';

type RoleAssignment = { permission_level: string | null; custom_role_id: number | null };

/** Privileged mutations must fail closed, unlike the legacy navigation fallback. */
export async function assignedPermissions(db: Db, companyId: number, role: RoleAssignment): Promise<Set<Permission> | null> {
  if (role.custom_role_id != null) {
    const row = await db.prepare('SELECT permissions FROM custom_roles WHERE id=? AND company_id=?')
      .get<{ permissions: string }>(role.custom_role_id, companyId);
    if (!row) return null;
    try {
      const values: unknown = JSON.parse(row.permissions);
      if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !ALL_PERMISSIONS.includes(value as Permission))) return null;
      return new Set(values as Permission[]);
    } catch { return null; }
  }
  return isBuiltInRole(role.permission_level) ? resolvePermissions(role.permission_level, null) : null;
}

export const canGrant = (actor: Set<Permission>, target: Set<Permission> | null) =>
  target !== null && [...target].every(permission => actor.has(permission));

export function teamForbidden() {
  return NextResponse.json({ error: 'You do not have permission to manage this employee or role.' }, { status: 403 });
}

export async function requireTeamManagement(database?: Db, authenticatedSession?: SessionContext) {
  const session = authenticatedSession ?? await getSessionContext();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const db = database ?? await getDb();
  const staff = session.staffId == null ? undefined : await db.prepare(
    'SELECT permission_level,custom_role_id FROM staff WHERE id=? AND company_id=?'
  ).get<RoleAssignment>(session.staffId, session.companyId);
  const permissions = session.isPlatformAdmin ? new Set(ALL_PERMISSIONS)
    : staff ? await assignedPermissions(db, session.companyId, staff) : null;
  if (!permissions?.has('team.manage')) return teamForbidden();
  return { session, permissions };
}

/** Re-read authority and assignments under the same write lock as the mutation. */
export async function runTeamMutation<T>(db: Db, guard: {
  session: SessionContext; companyId: number; staffId?: number; roleId?: number;
  assignment?: RoleAssignment; permissions?: Set<Permission>;
}, work: (tx: Db) => Promise<T>): Promise<T | Response> {
  return db.transaction(async tx => {
    // The request's cookie was already authenticated. Resolve only mutable
    // permission data here, using the transaction connection (not the replica).
    const access = await requireTeamManagement(tx, guard.session);
    if (access instanceof Response) return access;
    if (access.session.companyId !== guard.companyId) return teamForbidden();
    if (guard.staffId !== undefined) {
      const staff = await tx.prepare('SELECT permission_level,custom_role_id FROM staff WHERE id=? AND company_id=?')
        .get<RoleAssignment>(guard.staffId, guard.companyId);
      if (!staff) return NextResponse.json({error:'Not found'}, {status:404});
      if (!canGrant(access.permissions, await assignedPermissions(tx, guard.companyId, staff))) return teamForbidden();
    }
    if (guard.roleId !== undefined && !canGrant(access.permissions, await assignedPermissions(tx, guard.companyId, {
      permission_level:null, custom_role_id:guard.roleId,
    }))) return teamForbidden();
    if (guard.assignment && !canGrant(access.permissions, await assignedPermissions(tx, guard.companyId, guard.assignment))) return teamForbidden();
    if (guard.permissions && !canGrant(access.permissions, guard.permissions)) return teamForbidden();
    return work(tx);
  });
}

/** Staff endpoints are also consumed by assignment pickers; never serialize credentials. */
export function publicStaff(staff: Staff) {
  const { password_hash: _passwordHash, ...visible } = staff;
  return visible;
}
