import { NextResponse } from "next/server";
import { getDb, syncReplica, type CustomRole } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

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

type RoleResponse = {
  id: number;
  name: string;
  color: string;
  permissions: Permission[];
};

function serialize(row: CustomRole): RoleResponse {
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

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM custom_roles WHERE company_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(companyId)) as CustomRole[];
  return NextResponse.json(rows.map(serialize));
}

type CreateBody = {
  name?: string;
  color?: string;
  permissions?: string[];
};

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as CreateBody;

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const color = ALLOWED_COLORS.includes(body.color || "")
    ? (body.color as string)
    : "blue";
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

  const result = await db
    .prepare(
      `INSERT INTO custom_roles (company_id, name, color, permissions)
       VALUES (?, ?, ?, ?)`
    )
    .run(companyId, name, color, JSON.stringify(perms));

  const row = (await db
    .prepare("SELECT * FROM custom_roles WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, companyId)) as CustomRole;
  await syncReplica();
  return NextResponse.json(serialize(row), { status: 201 });
}
