import { NextResponse } from "next/server";
import { getDb, type MetaPage } from "@/lib/db";
import {
  subscribePageToLeadgen,
  unsubscribePageFromLeadgen,
} from "@/lib/meta";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const existing = (await db
    .prepare("SELECT * FROM meta_pages WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as MetaPage | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (body.enabled === undefined) {
    return NextResponse.json({ error: "Missing 'enabled'" }, { status: 400 });
  }
  const enabled = body.enabled ? 1 : 0;
  if (enabled !== existing.enabled && existing.page_access_token) {
    try {
      if (enabled) {
        await subscribePageToLeadgen(
          existing.page_id,
          existing.page_access_token
        );
      } else {
        await unsubscribePageFromLeadgen(
          existing.page_id,
          existing.page_access_token
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
  await db
    .prepare(
      "UPDATE meta_pages SET enabled = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?"
    )
    .run(enabled, id, companyId);
  const updated = (await db
    .prepare("SELECT * FROM meta_pages WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as MetaPage;
  return NextResponse.json({
    id: updated.id,
    page_id: updated.page_id,
    page_name: updated.page_name,
    enabled: !!updated.enabled,
    created_at: updated.created_at,
  });
}
