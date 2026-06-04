import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lightweight unread-message count for the global NavBar badge. The NavBar
// polls this on every page, so it must stay cheap: a single company-scoped
// aggregate over `messages` (backed by idx_messages_company_id), rather than
// the per-customer correlated subqueries in /api/messages/conversations,
// which exist to build the full inbox list and are wasteful for a badge.
export async function GET() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM messages
        WHERE company_id = ?
          AND direction = 'inbound'
          AND read_at IS NULL`
    )
    .get(companyId)) as { n: number } | undefined;
  return NextResponse.json({ unread: row?.n ?? 0 });
}
