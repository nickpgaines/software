import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export type Me = {
  identity: string;
  is_admin_account: boolean;
  staff: Staff | null;
};

function adminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

async function buildMe(identity: string): Promise<Me> {
  if (identity === adminUsername()) {
    return { identity, is_admin_account: true, staff: null };
  }
  const db = await getDb();
  const staff = (await db
    .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
    .get(identity.toLowerCase())) as Staff | undefined;
  return { identity, is_admin_account: false, staff: staff ?? null };
}

export async function GET() {
  const identity = getSessionUser();
  if (!identity) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json(await buildMe(identity));
}

export async function PATCH(req: Request) {
  const identity = getSessionUser();
  if (!identity) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (identity === adminUsername()) {
    return NextResponse.json(
      { error: "The built-in admin account can't be edited here." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    photo_url?: string | null;
  };

  const db = await getDb();
  const staff = (await db
    .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
    .get(identity.toLowerCase())) as Staff | undefined;
  if (!staff) {
    return NextResponse.json(
      { error: "No employee record found for this account." },
      { status: 404 }
    );
  }

  if (body.photo_url !== undefined) {
    await db
      .prepare(
        "UPDATE staff SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(body.photo_url, staff.id);
  }

  return NextResponse.json(await buildMe(identity));
}
