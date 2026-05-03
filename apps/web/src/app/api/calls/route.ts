import { NextResponse } from "next/server";
import { getDb, type Call } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

type CallWithCustomer = Call & {
  customer_name: string | null;
  customer_phone: string | null;
};

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const url = new URL(req.url);
  const customerIdRaw = url.searchParams.get("customer_id");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const customerId = customerIdRaw ? Number(customerIdRaw) : null;

  const db = await getDb();

  const sqlBase = `
    SELECT c.*,
           cu.name AS customer_name,
           cu.phone AS customer_phone
      FROM calls c
      LEFT JOIN customers cu
        ON cu.id = c.customer_id AND cu.company_id = c.company_id
     WHERE c.company_id = ?
  `;

  const rows = customerId
    ? ((await db
        .prepare(
          sqlBase +
            ` AND c.customer_id = ? ORDER BY c.created_at DESC, c.id DESC LIMIT ?`
        )
        .all(companyId, customerId, limit)) as CallWithCustomer[])
    : ((await db
        .prepare(
          sqlBase + ` ORDER BY c.created_at DESC, c.id DESC LIMIT ?`
        )
        .all(companyId, limit)) as CallWithCustomer[]);

  return NextResponse.json(rows, { headers: NO_CACHE_HEADERS });
}
