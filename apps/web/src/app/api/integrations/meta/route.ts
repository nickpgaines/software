import { NextResponse } from "next/server";
import { getDb, type MetaIntegration, type MetaPage } from "@/lib/db";
import { getMetaConfig } from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const integration = (await db
    .prepare("SELECT * FROM meta_integration WHERE id = 1")
    .get()) as MetaIntegration | undefined;
  const pages = (await db
    .prepare("SELECT * FROM meta_pages ORDER BY page_name COLLATE NOCASE ASC")
    .all()) as MetaPage[];
  const configured = !!getMetaConfig();
  return NextResponse.json({
    configured,
    connected: !!integration?.access_token,
    user_id: integration?.user_id ?? null,
    user_name: integration?.user_name ?? null,
    connected_at: integration?.connected_at ?? null,
    pages: pages.map((p) => ({
      id: p.id,
      page_id: p.page_id,
      page_name: p.page_name,
      enabled: !!p.enabled,
      created_at: p.created_at,
    })),
  });
}
