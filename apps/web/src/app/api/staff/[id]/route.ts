import { NextResponse } from "next/server";
import { getDb, syncReplica, type Staff, type PermissionLevel } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PERMISSION_LEVELS: PermissionLevel[] = [
  "admin",
  "salesperson",
  "technician",
];

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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const row = (await db
    .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Staff | undefined;
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

type PatchBody = {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  email?: string;
  password?: string;
  color?: string;
  permission_level?: PermissionLevel;
  custom_role_id?: number | null;
  photo_url?: string | null;
  name?: string;
  role?: string | null;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const existing = (await db
    .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Staff | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Legacy path: only name/role provided.
  if (
    body.first_name === undefined &&
    body.last_name === undefined &&
    body.email === undefined &&
    body.password === undefined &&
    body.color === undefined &&
    body.permission_level === undefined &&
    (body.name !== undefined || body.role !== undefined)
  ) {
    const name = (body.name ?? existing.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const role = body.role === undefined ? existing.role : body.role;
    await db
      .prepare(
        "UPDATE staff SET name = ?, role = ? WHERE id = ? AND company_id = ?"
      )
      .run(name, role, id, companyId);
    const updated = (await db
      .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
      .get(id, companyId)) as Staff;
    await syncReplica();
    return NextResponse.json(updated);
  }

  const first_name =
    body.first_name !== undefined
      ? body.first_name.trim()
      : existing.first_name || "";
  const last_name =
    body.last_name !== undefined
      ? body.last_name.trim()
      : existing.last_name || "";
  const email =
    body.email !== undefined
      ? body.email.trim().toLowerCase()
      : existing.email || "";

  if (!first_name) {
    return NextResponse.json(
      { error: "First name is required" },
      { status: 400 }
    );
  }
  if (!last_name) {
    return NextResponse.json(
      { error: "Last name is required" },
      { status: 400 }
    );
  }
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const phone =
    body.phone !== undefined
      ? body.phone?.toString().trim() || null
      : existing.phone;
  const color =
    body.color !== undefined && ALLOWED_COLORS.includes(body.color)
      ? body.color
      : existing.color || "blue";
  const permission_level =
    body.permission_level !== undefined &&
    PERMISSION_LEVELS.includes(body.permission_level)
      ? body.permission_level
      : existing.permission_level || "admin";

  let custom_role_id: number | null = existing.custom_role_id ?? null;
  if (body.custom_role_id !== undefined) {
    if (body.custom_role_id === null) {
      custom_role_id = null;
    } else if (
      typeof body.custom_role_id === "number" &&
      Number.isFinite(body.custom_role_id)
    ) {
      const exists = (await db
        .prepare(
          "SELECT id FROM custom_roles WHERE id = ? AND company_id = ? LIMIT 1"
        )
        .get(body.custom_role_id, companyId)) as { id: number } | undefined;
      custom_role_id = exists ? body.custom_role_id : null;
    }
  }

  const photo_url =
    body.photo_url !== undefined ? body.photo_url : existing.photo_url;

  const password_hash = body.password
    ? hashPassword(body.password)
    : existing.password_hash;

  const conflict = (await db
    .prepare("SELECT id FROM staff WHERE email = ? AND id != ?")
    .get(email, id)) as { id: number } | undefined;
  if (conflict) {
    return NextResponse.json(
      { error: "Email is already in use" },
      { status: 400 }
    );
  }

  const fullName = `${first_name} ${last_name}`.trim();

  await db.prepare(
    `UPDATE staff
     SET name = ?, first_name = ?, last_name = ?, phone = ?, email = ?,
         password_hash = ?, color = ?, permission_level = ?,
         custom_role_id = ?, photo_url = ?,
         updated_at = datetime('now')
     WHERE id = ? AND company_id = ?`
  ).run(
    fullName,
    first_name,
    last_name,
    phone,
    email,
    password_hash,
    color,
    permission_level,
    custom_role_id,
    photo_url,
    id,
    companyId
  );
  const updated = (await db
    .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Staff;
  await syncReplica();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM staff WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  await syncReplica();
  return NextResponse.json({ ok: true });
}
