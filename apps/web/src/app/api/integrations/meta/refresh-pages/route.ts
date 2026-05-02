import { NextResponse } from "next/server";
import { getDb, type MetaIntegration } from "@/lib/db";
import { fetchManagedPages } from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function POST() {
  const db = await getDb();
  const integration = (await db
    .prepare("SELECT * FROM meta_integration WHERE id = 1")
    .get()) as MetaIntegration | undefined;
  if (!integration?.access_token) {
    return NextResponse.json(
      { error: "Meta is not connected." },
      { status: 400 }
    );
  }
  try {
    const pages = await fetchManagedPages(integration.access_token);
    for (const p of pages) {
      await db
        .prepare(
          `INSERT INTO meta_pages (page_id, page_name, page_access_token, enabled)
             VALUES (?, ?, ?, 0)
             ON CONFLICT(page_id) DO UPDATE SET
               page_name = excluded.page_name,
               page_access_token = excluded.page_access_token,
               updated_at = datetime('now')`
        )
        .run(p.id, p.name, p.access_token);
    }
    return NextResponse.json({ ok: true, count: pages.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
