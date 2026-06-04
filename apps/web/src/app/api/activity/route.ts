import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  type: string;
  subject_type: string;
  subject_id: number | null;
  subject_label: string | null;
  amount_cents: number | null;
  metadata: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? Math.floor(limitRaw)
      : 20;
  const rows = (await db
    .prepare(
      `SELECT a.id, a.actor_user_id,
              COALESCE(NULLIF(TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), ''), s.name) AS actor_name,
              a.type, a.subject_type, a.subject_id, a.subject_label,
              a.amount_cents, a.metadata, a.created_at
         FROM activity_events a
         LEFT JOIN staff s ON s.id = a.actor_user_id
        WHERE a.company_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?`
    )
    .all(companyId, limit)) as Row[];
  return NextResponse.json(rows);
}
