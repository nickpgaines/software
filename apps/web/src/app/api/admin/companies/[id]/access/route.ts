import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isPlatformAdminRequest } from "@/lib/platform-admin";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isPlatformAdminRequest())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const companyId = Number(params.id);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }
  // Guard the platform tenant so a fat-finger in the admin UI can't lock
  // the founder out of their own dashboard.
  if (companyId === 1) {
    return NextResponse.json(
      { error: "The platform tenant cannot be revoked." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
  };
  const action = body.action;
  if (action !== "revoke" && action !== "restore") {
    return NextResponse.json(
      { error: "action must be 'revoke' or 'restore'" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const exists = await db
    .prepare("SELECT id FROM company WHERE id = ? LIMIT 1")
    .get<{ id: number }>(companyId);
  if (!exists) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (action === "revoke") {
    const reason = (body.reason || "").trim().slice(0, 500) || null;
    await db
      .prepare(
        `UPDATE company
           SET access_status = 'revoked',
               access_revoked_at = datetime('now'),
               access_revoked_reason = ?
         WHERE id = ?`
      )
      .run(reason, companyId);
  } else {
    await db
      .prepare(
        `UPDATE company
           SET access_status = 'active',
               access_revoked_at = NULL,
               access_revoked_reason = NULL
         WHERE id = ?`
      )
      .run(companyId);
  }

  return NextResponse.json({ ok: true, access_status: action === "revoke" ? "revoked" : "active" });
}
