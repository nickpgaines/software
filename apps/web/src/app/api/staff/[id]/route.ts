import { NextResponse } from "next/server";
import { getDb, type Staff, type PermissionLevel } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const PERMISSION_LEVELS: PermissionLevel[] = [
  "admin",
  "manager",
  "team_lead",
  "salesperson_all",
  "salesperson_own",
  "field_tech",
  "custom",
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
  const db = await getDb();
  const id = Number(params.id);
  const row = (await db.prepare("SELECT * FROM staff WHERE id = ?").get(id)) as
    | Staff
    | undefined;
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
  photo_url?: string | null;
  name?: string;
  role?: string | null;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  console.log("[/api/staff PATCH] received body keys:", Object.keys(body), {
    photo_url_type: typeof body.photo_url,
    photo_url_length:
      typeof body.photo_url === "string" ? body.photo_url.length : null,
    photo_url_preview:
      typeof body.photo_url === "string"
        ? body.photo_url.slice(0, 40) + "…"
        : body.photo_url,
  });
  const existing = (await db.prepare("SELECT * FROM staff WHERE id = ?").get(id)) as
    | Staff
    | undefined;
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
    await db.prepare("UPDATE staff SET name = ?, role = ? WHERE id = ?").run(
      name,
      role,
      id
    );
    const updated = (await db.prepare("SELECT * FROM staff WHERE id = ?").get(id)) as Staff;
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
      : existing.permission_level || "manager";
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
         password_hash = ?, color = ?, permission_level = ?, photo_url = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fullName,
    first_name,
    last_name,
    phone,
    email,
    password_hash,
    color,
    permission_level,
    photo_url,
    id
  );
  const updated = (await db.prepare("SELECT * FROM staff WHERE id = ?").get(id)) as Staff;
  console.log("[/api/staff PATCH] post-update photo_url:", {
    type: typeof updated.photo_url,
    length:
      typeof updated.photo_url === "string" ? updated.photo_url.length : null,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  await db.prepare("DELETE FROM staff WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
