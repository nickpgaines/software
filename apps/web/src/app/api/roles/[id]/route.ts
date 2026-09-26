import { NextResponse } from "next/server";
import { getDb, syncReplica, type CustomRole } from "@/lib/db";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { assignedPermissions, canGrant, requireTeamManagement, runTeamMutation, teamForbidden } from '@/lib/team-authorization';

export const dynamic = "force-dynamic";

const ALLOWED_COLORS = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "teal",
  "pink",
  "gray",
];

function serialize(row: CustomRole) {
  let perms: Permission[] = [];
  try {
    const parsed = JSON.parse(row.permissions);
    if (Array.isArray(parsed)) {
      perms = parsed.filter(
        (p): p is Permission =>
          typeof p === "string" && (ALL_PERMISSIONS as string[]).includes(p)
      );
    }
  } catch {
    perms = [];
  }
  return { id: row.id, name: row.name, color: row.color, permissions: perms };
}

type PatchBody = {
  name?: string;
  color?: string;
  permissions?: string[];
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await requireTeamManagement();
  if (access instanceof Response) return access;
  const companyId = access.session.companyId;
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM custom_roles WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as CustomRole | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canGrant(access.permissions, await assignedPermissions(db, companyId, { permission_level:null, custom_role_id:id }))) return teamForbidden();
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const color =
    body.color !== undefined && ALLOWED_COLORS.includes(body.color)
      ? body.color
      : existing.color;
  let permsJson = existing.permissions;
  if (body.permissions !== undefined) {
    const incoming = Array.isArray(body.permissions) ? body.permissions : [];
    const perms = incoming.filter(
      (p): p is Permission =>
        typeof p === "string" && (ALL_PERMISSIONS as string[]).includes(p)
    );
    if (perms.length === 0) {
      return NextResponse.json(
        { error: "At least one permission is required" },
        { status: 400 }
      );
    }
    permsJson = JSON.stringify(perms);
    if (!canGrant(access.permissions, new Set(perms))) return teamForbidden();
  }

  const result = await runTeamMutation(db, {session:access.session, companyId, roleId:id, permissions:new Set(JSON.parse(permsJson) as Permission[])}, tx => tx
    .prepare(
      `UPDATE custom_roles
       SET name = ?, color = ?, permissions = ?, updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(name, color, permsJson, id, companyId));
  if (result instanceof Response) return result;

  const row = (await db
    .prepare("SELECT * FROM custom_roles WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as CustomRole;
  await syncReplica();
  return NextResponse.json(serialize(row));
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const access = await requireTeamManagement();
  if (access instanceof Response) return access;
  const companyId = access.session.companyId;
  const db = await getDb();
  const id = Number(params.id);
  if (!await db.prepare('SELECT id FROM custom_roles WHERE id=? AND company_id=?').get(id, companyId)) {
    return NextResponse.json({error:'Not found'}, {status:404});
  }
  if (!canGrant(access.permissions, await assignedPermissions(db, companyId, { permission_level:null, custom_role_id:id }))) return teamForbidden();
  // Do not detach members: their underlying role may be admin. A single
  // guarded delete also prevents an assignment race from elevating a member.
  const removed = await runTeamMutation(db, {session:access.session, companyId, roleId:id}, tx => tx.prepare(`DELETE FROM custom_roles WHERE id=? AND company_id=?
    AND NOT EXISTS (SELECT 1 FROM staff WHERE custom_role_id=? AND company_id=?)`).run(id, companyId, id, companyId));
  if (removed instanceof Response) return removed;
  if (!removed.changes) return NextResponse.json({ error:'Reassign employees before deleting this role.' }, { status:409 });
  await syncReplica();
  return NextResponse.json({ ok: true });
}
