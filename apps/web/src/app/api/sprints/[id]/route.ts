import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function adminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

async function requireAdmin(): Promise<NextResponse | null> {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user === adminUsername()) return null;
  const db = await getDb();
  const staff = (await db
    .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
    .get(user.toLowerCase())) as Staff | undefined;
  if (staff?.permission_level === "admin") return null;
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const db = await getDb();
  const id = Number(params.id);
  await db.prepare("DELETE FROM sprints WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
