import { NextResponse } from "next/server";
import { getDb, type Company, type Db } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { DEFAULT_COMPANY_TIME_ZONE, isValidTimeZone } from "@/lib/time-zone";

export const dynamic = "force-dynamic";

// Per-request safety net: if a long-running server process predates the
// init-time migration that adds email/website/logo_url, add the columns on
// demand so saving the company info doesn't 500.
async function ensureCompanyColumns(db: Db): Promise<void> {
  const cols = (await db
    .prepare("PRAGMA table_info(company)")
    .all()) as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  const adds: [string, string][] = [
    ["time_zone", "TEXT NOT NULL DEFAULT 'America/New_York'"],
    ["email", "TEXT"],
    ["website", "TEXT"],
    ["logo_url", "TEXT"],
  ];
  for (const [col, def] of adds) {
    if (!have.has(col)) {
      await db.exec(`ALTER TABLE company ADD COLUMN ${col} ${def}`);
    }
  }
}

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  await ensureCompanyColumns(db);
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as Company | undefined;
  return NextResponse.json(
    row ?? {
      id: companyId,
      time_zone: DEFAULT_COMPANY_TIME_ZONE,
      name: null,
      address: null,
      phone: null,
      email: null,
      website: null,
      logo_url: null,
      updated_at: "",
    }
  );
}

export async function PUT(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  await ensureCompanyColumns(db);
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logo_url: string | null;
    time_zone: string;
  }>;
  if (Object.prototype.hasOwnProperty.call(body, "time_zone") && !isValidTimeZone(body.time_zone)) {
    return NextResponse.json({ error: "Enter a valid time zone, such as America/Chicago." }, { status: 400 });
  }
  try {
    await db
      .prepare(
        `UPDATE company
           SET name = ?,
               address = ?,
               phone = ?,
               email = ?,
               website = ?,
               logo_url = ?,
               time_zone = COALESCE(?, time_zone),
               updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        body.name || null,
        body.address || null,
        body.phone || null,
        body.email || null,
        body.website || null,
        body.logo_url === null
          ? null
          : typeof body.logo_url === "string" && body.logo_url.length > 0
            ? body.logo_url
            : null,
        body.time_zone ?? null,
        companyId
      );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "database error";
    console.error("settings/company PUT failed", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as Company;
  return NextResponse.json(row);
}
