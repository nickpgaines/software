import { NextResponse } from "next/server";
import { getDb, type MetaIntegration } from "@/lib/db";
import { fetchManagedPages } from "@/lib/meta";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const integration = (await db
    .prepare("SELECT * FROM meta_integration WHERE company_id = ? LIMIT 1")
    .get(companyId)) as MetaIntegration | undefined;
  if (!integration?.access_token) {
    return NextResponse.json(
      { error: "Meta is not connected." },
      { status: 400 }
    );
  }
  try {
    const pages = await fetchManagedPages(integration.access_token);
    for (const p of pages) {
      const existing = await db
        .prepare(
          "SELECT id FROM meta_pages WHERE company_id = ? AND page_id = ? LIMIT 1"
        )
        .get<{ id: number }>(companyId, p.id);
      if (existing) {
        await db
          .prepare(
            `UPDATE meta_pages
                SET page_name = ?, page_access_token = ?,
                    updated_at = datetime('now')
              WHERE id = ? AND company_id = ?`
          )
          .run(p.name, p.access_token, existing.id, companyId);
      } else {
        await db
          .prepare(
            `INSERT INTO meta_pages (company_id, page_id, page_name, page_access_token, enabled)
               VALUES (?, ?, ?, ?, 0)`
          )
          .run(companyId, p.id, p.name, p.access_token);
      }
    }
    return NextResponse.json({ ok: true, count: pages.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
