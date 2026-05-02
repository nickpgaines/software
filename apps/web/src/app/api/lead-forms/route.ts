import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb, type LeadForm } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "form"
  );
}

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT * FROM lead_forms WHERE company_id = ? ORDER BY created_at DESC"
    )
    .all(companyId)) as LeadForm[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<LeadForm>;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const baseSlug = slugify(name);
  const slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
  const fields =
    typeof body.fields === "string"
      ? body.fields
      : JSON.stringify([
          { key: "first_name", label: "First name", type: "text", required: true },
          { key: "last_name", label: "Last name", type: "text", required: true },
          { key: "email", label: "Email", type: "email", required: true },
          { key: "phone", label: "Phone", type: "tel", required: false },
        ]);
  const result = await db
    .prepare(
      `INSERT INTO lead_forms (company_id, name, slug, fields, enabled) VALUES (?, ?, ?, ?, 1)`
    )
    .run(companyId, name, slug, fields);
  const created = (await db
    .prepare("SELECT * FROM lead_forms WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, companyId)) as LeadForm;
  return NextResponse.json(created, { status: 201 });
}
