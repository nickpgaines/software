import { NextResponse } from "next/server";
import { getDb, type Company } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as Company | undefined;
  return NextResponse.json(
    row ?? {
      id: companyId,
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
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logo_url: string | null;
  }>;
  await db
    .prepare(
      `UPDATE company
         SET name = ?,
             address = ?,
             phone = ?,
             email = ?,
             website = ?,
             logo_url = ?,
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
      companyId
    );
  const row = (await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get(companyId)) as Company;
  return NextResponse.json(row);
}
