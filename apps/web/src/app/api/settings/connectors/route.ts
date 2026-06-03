import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// List active Claude connector sessions for the signed-in user. Each row
// represents an OAuth grant the user authorized; revoking it kills the
// access + refresh tokens immediately so Claude loses CRM access.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx || ctx.staffId == null) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT t.id, t.client_id, t.scope, t.created_at, t.last_used_at,
              t.expires_at, t.refresh_expires_at, c.client_name
         FROM mcp_access_tokens t
         LEFT JOIN mcp_oauth_clients c ON c.client_id = t.client_id
        WHERE t.company_id = ? AND t.staff_id = ? AND t.revoked_at IS NULL
        ORDER BY COALESCE(t.last_used_at, t.created_at) DESC`
    )
    .all(ctx.companyId, ctx.staffId);
  return NextResponse.json({ connections: rows });
}

export async function DELETE(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx || ctx.staffId == null) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const db = await getDb();
  const r = await db
    .prepare(
      `UPDATE mcp_access_tokens SET revoked_at = datetime('now')
         WHERE id = ? AND company_id = ? AND staff_id = ?`
    )
    .run(id, ctx.companyId, ctx.staffId);
  if (r.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
