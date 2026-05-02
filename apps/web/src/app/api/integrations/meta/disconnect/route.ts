import { NextResponse } from "next/server";
import { getDb, type MetaPage } from "@/lib/db";
import { unsubscribePageFromLeadgen } from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function POST() {
  const db = await getDb();
  const pages = (await db
    .prepare(
      "SELECT * FROM meta_pages WHERE enabled = 1 AND page_access_token IS NOT NULL"
    )
    .all()) as MetaPage[];
  for (const p of pages) {
    if (p.page_access_token) {
      await unsubscribePageFromLeadgen(p.page_id, p.page_access_token).catch(
        (e) => console.error("unsubscribe page failed", p.page_id, e)
      );
    }
  }
  await db.exec("DELETE FROM meta_pages");
  await db
    .prepare(
      `UPDATE meta_integration
          SET user_id = NULL, user_name = NULL, access_token = NULL,
              token_expires_at = NULL, connected_at = NULL,
              updated_at = datetime('now')
        WHERE id = 1`
    )
    .run();
  return NextResponse.json({ ok: true });
}
