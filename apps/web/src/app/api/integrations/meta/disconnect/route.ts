import { NextResponse } from "next/server";
import { getDb, type MetaPage } from "@/lib/db";
import { unsubscribePageFromLeadgen } from "@/lib/meta";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const pages = (await db
    .prepare(
      "SELECT * FROM meta_pages WHERE company_id = ? AND enabled = 1 AND page_access_token IS NOT NULL"
    )
    .all(companyId)) as MetaPage[];
  for (const p of pages) {
    if (p.page_access_token) {
      await unsubscribePageFromLeadgen(p.page_id, p.page_access_token).catch(
        (e) => console.error("unsubscribe page failed", p.page_id, e)
      );
    }
  }
  await db
    .prepare("DELETE FROM meta_pages WHERE company_id = ?")
    .run(companyId);
  await db
    .prepare(
      `UPDATE meta_integration
          SET user_id = NULL, user_name = NULL, access_token = NULL,
              token_expires_at = NULL, connected_at = NULL,
              updated_at = datetime('now')
        WHERE company_id = ?`
    )
    .run(companyId);
  return NextResponse.json({ ok: true });
}
