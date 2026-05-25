import { NextResponse } from "next/server";
import { getDb, syncReplica, type CustomRole } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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
  return { id: row.id, name: row.name, permissions: perms };
}

type PatchBody = {
  name?: string;
  permissions?: string[];
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM custom_roles WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as CustomRole | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
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
  }

  await db
    .prepare(
      `UPDATE custom_roles
       SET name = ?, permissions = ?, updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(name, permsJson, id, companyId);

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
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  // Detach any staff currently using this role so we don't orphan FKs.
  await db
    .prepare(
      "UPDATE staff SET custom_role_id = NULL WHERE custom_role_id = ? AND company_id = ?"
    )
    .run(id, companyId);
  await db
    .prepare("DELETE FROM custom_roles WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  await syncReplica();
  return NextResponse.json({ ok: true });
}
