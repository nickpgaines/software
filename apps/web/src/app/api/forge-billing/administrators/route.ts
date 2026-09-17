import { NextResponse } from "next/server";
import { getDb, syncReplica, type Db } from "@/lib/db";
import { billingResponse, billingSession } from "@/lib/forge-billing/http";
import { BillingError } from "@/lib/forge-billing/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MinimalStaff = { id: number; name: string };

async function requireActualAdministrator(
  db: Db,
  companyId: number,
  staffId: number | null
) {
  if (staffId == null) {
    throw new BillingError("Company administrator access required", 403);
  }
  const actor = await db
    .prepare(
      `SELECT id, name
         FROM staff
        WHERE id = ? AND company_id = ? AND permission_level = 'admin'
        LIMIT 1`
    )
    .get<MinimalStaff>(staffId, companyId);
  if (!actor) {
    throw new BillingError("Company administrator access required", 403);
  }
  return actor;
}

export async function GET(req: Request) {
  return billingResponse(async () => {
    const session = await billingSession(req);
    const db = await getDb();
    await requireActualAdministrator(db, session.companyId, session.staffId);
    const rows = await db
      .prepare(
        `SELECT id, name, permission_level
           FROM staff
          WHERE company_id = ?
          ORDER BY name COLLATE NOCASE, id`
      )
      .all<MinimalStaff & { permission_level: string }>(session.companyId);
    return {
      administrators: rows
        .filter((row) => row.permission_level === "admin")
        .map(({ id, name }) => ({ id, name })),
      eligibleStaff: rows
        .filter((row) => row.permission_level !== "admin")
        .map(({ id, name }) => ({ id, name })),
    };
  });
}

export async function POST(req: Request) {
  return billingResponse(async () => {
    const session = await billingSession(req);
    const body = (await req.json().catch(() => ({}))) as { staffId?: unknown };
    if (!Number.isInteger(body.staffId) || Number(body.staffId) <= 0) {
      throw new BillingError("Select an eligible employee", 400);
    }
    const db = await getDb();
    const result = await db.transaction(async (tx) => {
      await requireActualAdministrator(tx, session.companyId, session.staffId);
      const target = await tx
        .prepare(
          `SELECT id, name, permission_level
             FROM staff
            WHERE id = ? AND company_id = ?
            LIMIT 1`
        )
        .get<MinimalStaff & { permission_level: string }>(
          Number(body.staffId),
          session.companyId
        );
      if (!target || target.id === session.staffId) {
        throw new BillingError("Select an eligible employee", 404);
      }
      if (target.permission_level === "admin") {
        throw new BillingError("That employee is already an administrator", 409);
      }
      const updated = await tx
        .prepare(
          `UPDATE staff
              SET permission_level = 'admin',
                  custom_role_id = NULL,
                  updated_at = datetime('now')
            WHERE id = ?
              AND company_id = ?
              AND permission_level != 'admin'`
        )
        .run(target.id, session.companyId);
      if (updated.changes !== 1) {
        throw new BillingError("Employee changed; refresh and try again", 409);
      }
      return {
        ok: true,
        administrator: { id: target.id, name: target.name },
      };
    });
    await syncReplica();
    return result;
  });
}
