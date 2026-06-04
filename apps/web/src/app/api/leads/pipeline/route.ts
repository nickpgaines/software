import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Stages mirror the CHECK constraint on leads.stage and the order shown
// on the kanban board (LeadsPipelineClient).
const STAGES: { key: string; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "responded", label: "Responded" },
  { key: "estimate_sent", label: "Estimate Sent" },
];

export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT stage, COUNT(*) AS count
         FROM leads
        WHERE company_id = ?
        GROUP BY stage`
    )
    .all(companyId)) as { stage: string; count: number }[];

  const counts = new Map(rows.map((r) => [r.stage, r.count]));
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  const entries = STAGES.map((s) => {
    const count = counts.get(s.key) ?? 0;
    return {
      label: s.label,
      count,
      value: 0,
      pct: max > 0 ? count / max : 0,
    };
  });

  return NextResponse.json(entries);
}
