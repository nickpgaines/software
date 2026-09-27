import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  mergeCustomizations,
  type CustomizationConfig,
} from "@/lib/customizations";
import { loadCustomizations } from "@/lib/customization-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const config = await loadCustomizations(db, ctx.companyId);
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<CustomizationConfig>;
  const db = await getDb();
  const current = await loadCustomizations(db, ctx.companyId);
  const next = mergeCustomizations({ ...current, ...body });

  await db
    .prepare(
      `UPDATE customization_settings
         SET config = ?, updated_at = datetime('now')
       WHERE company_id = ?`
    )
    .run(JSON.stringify(next), ctx.companyId);
  const exists = (await db
    .prepare("SELECT id FROM customization_settings WHERE company_id = ? LIMIT 1")
    .get(ctx.companyId)) as { id: number } | undefined;
  if (!exists) {
    await db
      .prepare(
        "INSERT INTO customization_settings (company_id, config) VALUES (?, ?)"
      )
      .run(ctx.companyId, JSON.stringify(next));
  }
  return NextResponse.json(next);
}
