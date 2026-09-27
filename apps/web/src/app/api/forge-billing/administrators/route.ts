import { NextResponse } from "next/server";
import { getDb, syncReplica, type Db } from "@/lib/db";
import { billingResponse, billingSession } from "@/lib/forge-billing/http";
import { BillingError } from "@/lib/forge-billing/config";
import { assignedPermissions, canGrant } from '@/lib/team-authorization';
import { ALL_PERMISSIONS } from '@/lib/permissions';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MinimalStaff = { id: number; name: string };
type StaffRole = MinimalStaff & { permission_level:string; custom_role_id:number|null };

async function isFullAdministrator(db: Db, companyId: number, staff: StaffRole) {
  const permissions = await assignedPermissions(db, companyId, staff);
  return permissions !== null && canGrant(permissions, new Set(ALL_PERMISSIONS));
}

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
      `SELECT id, name, permission_level, custom_role_id
         FROM staff
        WHERE id = ? AND company_id = ?
        LIMIT 1`
    )
    .get<StaffRole>(staffId, companyId);
  if (!actor || !await isFullAdministrator(db, companyId, actor)) {
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
        `SELECT id, name, permission_level, custom_role_id
           FROM staff
          WHERE company_id = ?
          ORDER BY name COLLATE NOCASE, id`
      )
      .all<StaffRole>(session.companyId);
    const resolved = await Promise.all(rows.map(async row => ({...row, admin:await isFullAdministrator(db, session.companyId, row)})));
    return {
      administrators: resolved
        .filter((row) => row.admin)
        .map(({ id, name }) => ({ id, name })),
      eligibleStaff: resolved
        .filter((row) => !row.admin)
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
          `SELECT id, name, permission_level, custom_role_id
             FROM staff
            WHERE id = ? AND company_id = ?
            LIMIT 1`
        )
        .get<StaffRole>(
          Number(body.staffId),
          session.companyId
        );
      if (!target || target.id === session.staffId) {
        throw new BillingError("Select an eligible employee", 404);
      }
      if (await isFullAdministrator(tx, session.companyId, target)) {
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
              AND (permission_level != 'admin' OR custom_role_id IS NOT NULL)`
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
