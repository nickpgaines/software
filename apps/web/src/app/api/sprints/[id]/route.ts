import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<
  { ok: true; companyId: number } | NextResponse
> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (ctx.isPlatformAdmin) {
    return { ok: true, companyId: ctx.companyId };
  }
  const db = await getDb();
  const staff = (await db
    .prepare(
      "SELECT permission_level FROM staff WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(ctx.staffId, ctx.companyId)) as
    | { permission_level: string }
    | undefined;
  if (staff?.permission_level === "admin") {
    return { ok: true, companyId: ctx.companyId };
  }
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const db = await getDb();
  const id = Number(params.id);
  await db
    .prepare("DELETE FROM sprints WHERE id = ? AND company_id = ?")
    .run(id, auth.companyId);
  return NextResponse.json({ ok: true });
}
