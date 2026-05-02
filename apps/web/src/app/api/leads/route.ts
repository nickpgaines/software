import { NextResponse } from "next/server";
import { getDb, type Lead } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const search = url.searchParams.get("q")?.trim();
  const where: string[] = ["company_id = ?"];
  const args: (string | number)[] = [companyId];
  if (stage) {
    where.push("stage = ?");
    args.push(stage);
  }
  if (search) {
    where.push(
      "(LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) LIKE ?" +
        " OR LOWER(COALESCE(email,'')) LIKE ?" +
        " OR COALESCE(phone,'') LIKE ?" +
        " OR LOWER(COALESCE(address,'')) LIKE ?)"
    );
    const like = `%${search.toLowerCase()}%`;
    args.push(like, like, like, like);
  }
  const sql =
    `SELECT * FROM leads WHERE ${where.join(" AND ")}` +
    " ORDER BY position ASC, created_at DESC";
  const rows = (await db.prepare(sql).all(...args)) as Lead[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<Lead>;
  const first = (body.first_name || "").trim() || null;
  const last = (body.last_name || "").trim() || null;
  if (!first && !last && !body.email && !body.phone) {
    return NextResponse.json(
      { error: "Provide a name, email, or phone." },
      { status: 400 }
    );
  }
  const stage = (body.stage as string) || "new";
  const result = await db
    .prepare(
      `INSERT INTO leads
         (company_id, first_name, last_name, email, phone, address, source,
          source_page_id, source_page_name, source_form_id, source_form_name,
          stage, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      first,
      last,
      body.email || null,
      body.phone || null,
      body.address || null,
      body.source || "manual",
      body.source_page_id || null,
      body.source_page_name || null,
      body.source_form_id || null,
      body.source_form_name || null,
      stage,
      body.notes || null
    );
  const created = (await db
    .prepare("SELECT * FROM leads WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, companyId)) as Lead;
  return NextResponse.json(created, { status: 201 });
}
