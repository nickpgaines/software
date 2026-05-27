import { NextResponse } from "next/server";
import { getDb, type SubscriptionChargeAttempt } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Dunning history for a subscription: every recurring charge attempt, newest
// first, success and failure alike.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT * FROM subscription_charge_attempts
        WHERE company_id = ? AND subscription_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 100`
    )
    .all(companyId, Number(params.id))) as SubscriptionChargeAttempt[];
  return NextResponse.json(rows);
}
