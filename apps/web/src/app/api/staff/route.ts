import { NextResponse } from "next/server";
import { getDb, syncReplica, type Staff, type PermissionLevel } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireCompanyId } from "@/lib/auth";

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

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM staff WHERE company_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(companyId)) as Staff[];
  return NextResponse.json(rows);
}

type CreateBody = {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  email?: string;
  password?: string;
  color?: string;
  permission_level?: PermissionLevel;
  photo_url?: string | null;
  // legacy
  name?: string;
  role?: string | null;
};

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as CreateBody;

  // Legacy single-field path: just name + role.
  if (!body.first_name && !body.email && !body.password && body.name) {
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const result = await db
      .prepare(
        "INSERT INTO staff (company_id, name, role, first_name) VALUES (?, ?, ?, ?)"
      )
      .run(companyId, name, body.role || null, name.split(/\s+/)[0] || name);
    const created = (await db
      .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
      .get(result.lastInsertRowid, companyId)) as Staff;
    // Force the local replica to pick up the insert so the router.refresh()
    // landing on this instance sees the new row immediately.
    await syncReplica();
    return NextResponse.json(created, { status: 201 });
  }

  const first_name = (body.first_name || "").trim();
  const last_name = (body.last_name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

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
  if (!password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  const color = ALLOWED_COLORS.includes(body.color || "")
    ? (body.color as string)
    : "blue";
  const permission_level = PERMISSION_LEVELS.includes(
    body.permission_level as PermissionLevel
  )
    ? (body.permission_level as PermissionLevel)
    : "manager";

  const phone = body.phone?.toString().trim() || null;
  const photo_url = body.photo_url || null;
  const fullName = `${first_name} ${last_name}`.trim();
  const password_hash = hashPassword(password);

  const exists = (await db
    .prepare("SELECT id FROM staff WHERE email = ?")
    .get(email)) as { id: number } | undefined;
  if (exists) {
    return NextResponse.json(
      { error: "Email is already in use" },
      { status: 400 }
    );
  }

  let result: { lastInsertRowid: number };
  try {
    result = await db
      .prepare(
        `INSERT INTO staff
         (company_id, name, first_name, last_name, phone, email, password_hash,
          color, permission_level, photo_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        companyId,
        fullName,
        first_name,
        last_name,
        phone,
        email,
        password_hash,
        color,
        permission_level,
        photo_url
      );
  } catch (err) {
    console.error("[/api/staff POST] insert failed:", err);
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { error: `Could not create employee: ${message}` },
      { status: 500 }
    );
  }

  const created = (await db
    .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, companyId)) as Staff | undefined;
  if (created) {
    // Force the local replica to pick up the insert so the router.refresh()
    // landing on this instance sees the new row immediately.
    await syncReplica();
  }
  if (!created) {
    // Fall back to email lookup in case the driver didn't return lastInsertRowid.
    const fallback = (await db
      .prepare("SELECT * FROM staff WHERE email = ? AND company_id = ?")
      .get(email, companyId)) as Staff | undefined;
    if (fallback) {
      await syncReplica();
      return NextResponse.json(fallback, { status: 201 });
    }
    console.error(
      "[/api/staff POST] insert appeared to succeed but row not found",
      { lastInsertRowid: result.lastInsertRowid, email }
    );
    return NextResponse.json(
      { error: "Employee was not saved. Check the server logs." },
      { status: 500 }
    );
  }
  return NextResponse.json(created, { status: 201 });
}
