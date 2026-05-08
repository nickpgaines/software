import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  DEFAULT_CUSTOMIZATIONS,
  mergeCustomizations,
  type CustomizationConfig,
} from "@/lib/customizations";

export const dynamic = "force-dynamic";

type Row = { config: string };

async function loadConfig(companyId: number): Promise<CustomizationConfig> {
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT config FROM customization_settings WHERE company_id = ? LIMIT 1"
    )
    .get(companyId)) as Row | undefined;
  if (!row) {
    await db
      .prepare(
        "INSERT INTO customization_settings (company_id, config) VALUES (?, ?)"
      )
      .run(companyId, JSON.stringify(DEFAULT_CUSTOMIZATIONS));
    return DEFAULT_CUSTOMIZATIONS;
  }
  try {
    const parsed = JSON.parse(row.config) as Partial<CustomizationConfig>;
    return mergeCustomizations(parsed);
  } catch {
    return DEFAULT_CUSTOMIZATIONS;
  }
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await loadConfig(ctx.companyId);
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<CustomizationConfig>;
  const current = await loadConfig(ctx.companyId);
  const next = mergeCustomizations({ ...current, ...body });

  const db = await getDb();
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
